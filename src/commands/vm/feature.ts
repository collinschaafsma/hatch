import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import fs from "fs-extra";
import type { VMRecord } from "../../types/index.js";
import {
	checkExeDevAccess,
	exeDevNew,
	exeDevRm,
	exeDevSharePort,
	waitForVMReady,
} from "../../utils/exe-dev.js";
import { log } from "../../utils/logger.js";
import { getProject } from "../../utils/project-store.js";
import { createSpinner } from "../../utils/spinner.js";
import { scpToRemote, sshExec } from "../../utils/ssh.js";
import { addVM } from "../../utils/vm-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "../../..");

interface VMFeatureOptions {
	project: string;
	config?: string;
}

export const vmFeatureCommand = new Command()
	.name("feature")
	.description(
		"Create a new VM for feature development with isolated Supabase branches",
	)
	.argument("<feature-name>", "Name of the feature branch to create")
	.requiredOption("--project <name>", "Project name (from hatch vm new)")
	.option(
		"-c, --config <path>",
		"Path to hatch.json config file",
		path.join(os.homedir(), ".hatch.json"),
	)
	.action(async (featureName: string, options: VMFeatureOptions) => {
		let vmName: string | undefined;
		let sshHost: string | undefined;

		try {
			log.blank();
			log.info(`Creating feature VM: ${featureName}`);
			log.info(`Project: ${options.project}`);
			log.blank();

			// Step 1: Look up project
			const project = await getProject(options.project);
			if (!project) {
				log.error(`Project not found: ${options.project}`);
				log.info("Run 'hatch vm list --projects' to see available projects.");
				log.info("Run 'hatch vm new <project-name>' to create a new project.");
				process.exit(1);
			}

			// Step 2: Check exe.dev access
			const accessSpinner = createSpinner(
				"Checking exe.dev SSH access",
			).start();
			const access = await checkExeDevAccess();

			if (!access.available) {
				accessSpinner.fail("Cannot connect to exe.dev");
				log.blank();
				log.error(access.error || "Unknown error");
				process.exit(1);
			}
			accessSpinner.succeed("exe.dev SSH access confirmed");

			// Check config file exists and load it
			const configPath =
				options.config || path.join(os.homedir(), ".hatch.json");
			if (!(await fs.pathExists(configPath))) {
				log.blank();
				log.error(`Config file not found: ${configPath}`);
				log.info("Run 'hatch config --global' to create a config file.");
				log.blank();
				process.exit(1);
			}

			// Load config to get tokens for CLI commands
			const config = await fs.readJson(configPath);
			const supabaseToken = config.supabase?.token || "";
			const vercelToken = config.vercel?.token || "";

			// Step 3: Create new VM
			const vmSpinner = createSpinner("Creating exe.dev VM").start();
			const vm = await exeDevNew();
			vmName = vm.name;
			sshHost = vm.sshHost;
			vmSpinner.succeed(`VM created: ${vmName}`);

			// Step 4: Wait for VM to be ready
			const readySpinner = createSpinner(
				`Waiting for VM to be ready (${sshHost})`,
			).start();
			await waitForVMReady(sshHost, 120000);
			readySpinner.succeed("VM is ready");

			// Step 5: Configure exe.dev to forward port 3000 (Next.js default)
			const portSpinner = createSpinner(
				"Configuring web preview port",
			).start();
			try {
				await exeDevSharePort(vmName, 3000);
				portSpinner.succeed("Web preview configured for port 3000");
			} catch {
				portSpinner.warn(
					"Could not configure port. Run manually: ssh exe.dev share port " +
						vmName +
						" 3000",
				);
			}

			// Step 6: Copy config file to VM
			const configSpinner = createSpinner("Copying config file to VM").start();
			await scpToRemote(configPath, sshHost, "~/.hatch.json");
			configSpinner.succeed("Config file copied");

			// Step 7: Copy and run feature install script
			const installSpinner = createSpinner(
				"Setting up feature VM (installing CLIs, cloning repo)",
			).start();

			// Copy the local script to VM instead of curling from GitHub
			// This ensures we always use the current version and allows testing without pushing
			const scriptPath = path.join(
				packageRoot,
				"scripts",
				"feature-install.sh",
			);
			if (!(await fs.pathExists(scriptPath))) {
				installSpinner.fail("Feature install script not found");
				log.error(`Expected script at: ${scriptPath}`);
				throw new Error("Feature install script not found");
			}

			await scpToRemote(scriptPath, sshHost, "~/feature-install.sh");
			const installCommand = `chmod +x ~/feature-install.sh && ~/feature-install.sh ${project.github.url} --config ~/.hatch.json`;

			try {
				await sshExec(sshHost, installCommand, {
					timeoutMs: 10 * 60 * 1000,
				});
				installSpinner.succeed("Feature VM setup complete");
			} catch (error) {
				installSpinner.fail("Failed to set up feature VM");
				if (error instanceof Error && "stderr" in error) {
					const stderr = (error as { stderr?: string }).stderr;
					if (stderr) {
						log.error("Install script output:");
						console.log(stderr.slice(-2000));
					}
				}
				throw error;
			}

			const projectPath = `~/${project.github.repo}`;

			// Environment setup for commands that need CLIs installed to ~/.local/bin
			// Include SUPABASE_ACCESS_TOKEN for supabase CLI authentication
			const envPrefix = `export PATH="$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH" && export SUPABASE_ACCESS_TOKEN="${supabaseToken}" &&`;

			// Step 8: Create git branch from origin/main
			const gitSpinner = createSpinner("Creating git branch").start();
			try {
				await sshExec(
					sshHost,
					`cd ${projectPath} && git fetch origin && git checkout -b ${featureName} origin/main`,
				);
				gitSpinner.succeed(`Git branch created: ${featureName}`);
			} catch (error) {
				gitSpinner.fail("Failed to create git branch");
				throw error;
			}

			// Step 9: Configure Next.js allowedDevOrigins for exe.dev preview
			const nextConfigSpinner = createSpinner(
				"Configuring Next.js for exe.dev preview",
			).start();
			try {
				// Add allowedDevOrigins to next.config.ts for the VM's exe.dev URL
				// Use sed substitution to add the property after the opening brace
				// Note: allowedDevOrigins takes hostnames, not full URLs
				// Use 2 spaces for indentation to match biome formatter config
				const exeDevOrigin = `${vmName}.exe.xyz`;
				await sshExec(
					sshHost,
					`cd ${projectPath}/apps/web && sed -i 's/const nextConfig: NextConfig = {/const nextConfig: NextConfig = {\\n  allowedDevOrigins: ["${exeDevOrigin}"],/' next.config.ts`,
				);
				nextConfigSpinner.succeed("Next.js configured for exe.dev preview");
			} catch {
				nextConfigSpinner.warn(
					"Could not configure allowedDevOrigins. You may see cross-origin warnings.",
				);
			}

			// Step 10: Link Supabase project
			const linkSpinner = createSpinner("Linking Supabase project").start();
			try {
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath} && supabase link --project-ref ${project.supabase.projectRef}`,
				);
				linkSpinner.succeed(
					`Supabase project linked: ${project.supabase.projectRef}`,
				);
			} catch (error) {
				linkSpinner.fail("Failed to link Supabase project");
				throw error;
			}

			// Step 11: Create Supabase branches (main and test)
			const mainBranch = featureName;
			const testBranch = `${featureName}-test`;

			const supabaseSpinner = createSpinner(
				"Creating Supabase branches",
			).start();
			try {
				// Create main feature branch (persistent)
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath} && supabase branches create ${mainBranch} --persistent`,
				);

				// Create test branch (persistent)
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath} && supabase branches create ${testBranch} --persistent`,
				);

				supabaseSpinner.succeed(
					`Supabase branches created: ${mainBranch}, ${testBranch}`,
				);
			} catch (error) {
				supabaseSpinner.fail("Failed to create Supabase branches");
				throw error;
			}

			// Step 12: Pull Vercel environment variables to create .env.local
			const vercelEnvSpinner = createSpinner(
				"Pulling environment variables from Vercel",
			).start();
			// Link Vercel project first
			const { stdout: linkOut, stderr: linkErr } = await sshExec(
				sshHost,
				`${envPrefix} cd ${projectPath}/apps/web && vercel link --yes --project ${project.vercel.projectId} --token "${vercelToken}" 2>&1 || true`,
			);
			console.log(`[DEBUG] vercel link - stdout: "${linkOut}", stderr: "${linkErr}"`);
			// Pull development environment variables (may output warnings to stderr)
			const { stdout: pullOut, stderr: pullErr } = await sshExec(
				sshHost,
				`${envPrefix} cd ${projectPath}/apps/web && vercel env pull .env.local --environment=development --token "${vercelToken}" 2>&1 || true`,
			);
			console.log(`[DEBUG] vercel env pull - stdout: "${pullOut}", stderr: "${pullErr}"`)
			// Check if .env.local was created (use $HOME instead of ~ for reliable expansion)
			const { stdout: envCheck, stderr: envCheckErr } = await sshExec(
				sshHost,
				`test -f $HOME/${project.github.repo}/apps/web/.env.local && echo "exists" || echo "missing"`,
			);
			const checkResult = envCheck.trim();
			// Debug: log what we got
			console.log(`[DEBUG] .env.local check - stdout: "${checkResult}", stderr: "${envCheckErr}"`);
			if (checkResult === "exists") {
				vercelEnvSpinner.succeed("Environment variables pulled from Vercel");
			} else {
				vercelEnvSpinner.warn(
					`Could not pull env from Vercel (check returned: "${checkResult}"). You may need to create .env.local manually.`,
				);
			}

			// Step 13: Wait for branches to provision and get credentials
			const credSpinner = createSpinner(
				"Waiting for Supabase branches to provision",
			).start();
			try {
				// Wait for branches to be ready (can take up to a minute)
				await new Promise((resolve) => setTimeout(resolve, 45000));

				let mainDbUrl: string | undefined;
				let testDbUrl: string | undefined;

				// Get main branch credentials
				const { stdout: mainOutput } = await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath} && supabase branches get ${mainBranch} -o env 2>/dev/null || echo ''`,
				);
				const mainMatch = mainOutput.match(/POSTGRES_URL="?([^"\n]+)"?/);
				if (mainMatch?.[1]) {
					mainDbUrl = mainMatch[1];
				}

				// Get test branch credentials
				const { stdout: testOutput } = await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath} && supabase branches get ${testBranch} -o env 2>/dev/null || echo ''`,
				);
				const testMatch = testOutput.match(/POSTGRES_URL="?([^"\n]+)"?/);
				if (testMatch?.[1]) {
					testDbUrl = testMatch[1];
				}

				// Update .env.local with both URLs
				// Use sed to replace if line exists, or append if it doesn't
				if (mainDbUrl || testDbUrl) {
					if (mainDbUrl) {
						await sshExec(
							sshHost,
							`cd ${projectPath}/apps/web && (grep -q '^DATABASE_URL=' .env.local && sed -i 's|^DATABASE_URL=.*|DATABASE_URL=${mainDbUrl}|' .env.local || echo 'DATABASE_URL=${mainDbUrl}' >> .env.local)`,
						);
					}
					if (testDbUrl) {
						await sshExec(
							sshHost,
							`cd ${projectPath}/apps/web && (grep -q '^TEST_DATABASE_URL=' .env.local && sed -i 's|^TEST_DATABASE_URL=.*|TEST_DATABASE_URL=${testDbUrl}|' .env.local || echo 'TEST_DATABASE_URL=${testDbUrl}' >> .env.local)`,
						);
					}
					credSpinner.succeed(
						`Branch credentials configured (DATABASE_URL${testDbUrl ? " + TEST_DATABASE_URL" : ""})`,
					);
				} else {
					credSpinner.warn(
						"Could not get branch DATABASE_URLs automatically. You may need to update .env.local manually.",
					);
				}

				// Update app URLs for exe.dev proxy access
				const appUrl = `https://${vmName}.exe.xyz`;
				await sshExec(
					sshHost,
					`cd ${projectPath}/apps/web && (grep -q '^BETTER_AUTH_URL=' .env.local && sed -i 's|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=${appUrl}|' .env.local || echo 'BETTER_AUTH_URL=${appUrl}' >> .env.local)`,
				);
				await sshExec(
					sshHost,
					`cd ${projectPath}/apps/web && (grep -q '^NEXT_PUBLIC_APP_URL=' .env.local && sed -i 's|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=${appUrl}|' .env.local || echo 'NEXT_PUBLIC_APP_URL=${appUrl}' >> .env.local)`,
				);
			} catch {
				credSpinner.warn(
					"Could not configure branch credentials automatically. You may need to update .env.local manually.",
				);
			}

			// Step 14: Push branch to origin
			const pushSpinner = createSpinner("Pushing branch to origin").start();
			try {
				await sshExec(
					sshHost,
					`cd ${projectPath} && git push -u origin ${featureName}`,
				);
				pushSpinner.succeed("Branch pushed to origin");
			} catch (error) {
				pushSpinner.fail("Failed to push branch");
				throw error;
			}

			// Step 15: Save VM to local tracking
			const vmRecord: VMRecord = {
				name: vmName,
				sshHost,
				project: project.name,
				feature: featureName,
				createdAt: new Date().toISOString(),
				supabaseBranches: [mainBranch, testBranch],
				githubBranch: featureName,
			};
			await addVM(vmRecord);

			// Print summary
			log.blank();
			log.success("Feature VM created successfully!");
			log.blank();
			log.info("Feature details:");
			log.step(`VM:              ${vmName}`);
			log.step(`Project:         ${project.name}`);
			log.step(`Git branch:      ${featureName}`);
			log.step(`Supabase branch: ${mainBranch}`);
			log.step(`Test branch:     ${testBranch}`);
			log.blank();
			log.info("Connect:");
			log.step(`SSH:     ssh ${sshHost}`);
			log.step(
				`VS Code: vscode://vscode-remote/ssh-remote+${sshHost}/home/exedev/${project.github.repo}`,
			);
			log.step(
				`Web:     https://${vmName}.exe.xyz (once app runs on port 3000)`,
			);
			log.blank();
			log.info("To start working:");
			log.step(`ssh ${sshHost}`);
			log.step(`cd ~/${project.github.repo} && claude`);
			log.blank();
			log.info("When done:");
			log.step(`hatch vm clean ${featureName} --project ${project.name}`);
			log.blank();
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("User force closed")
			) {
				log.blank();
				log.info("Operation cancelled.");
			} else {
				log.blank();
				log.error(
					`Failed to create feature VM: ${error instanceof Error ? error.message : error}`,
				);
			}

			// Rollback: delete VM if it was created
			if (vmName) {
				log.info("Rolling back: deleting VM...");
				try {
					await exeDevRm(vmName);
					log.success("VM deleted");
				} catch (rollbackError) {
					log.warn(
						`Failed to delete VM ${vmName}. Delete manually with: ssh exe.dev rm ${vmName}`,
					);
				}
			}

			process.exit(1);
		}
	});
