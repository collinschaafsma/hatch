import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import fs from "fs-extra";
import {
	createConvexFeatureProject,
	deleteConvexProject,
} from "../headless/convex.js";
import type { EnvVar, VMRecord } from "../types/index.js";
import {
	checkExeDevAccess,
	exeDevNew,
	exeDevRm,
	exeDevSharePort,
	waitForVMReady,
} from "../utils/exe-dev.js";
import { log } from "../utils/logger.js";
import { getProject } from "../utils/project-store.js";
import { createSpinner } from "../utils/spinner.js";
import { scpToRemote, sshExec } from "../utils/ssh.js";
import { checkAndPromptTokenRefresh } from "../utils/token-check.js";
import {
	isClaudeTokenExpired,
	refreshClaudeTokenOnly,
} from "../utils/token-refresh.js";
import { addVM } from "../utils/vm-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "../..");

interface FeatureOptions {
	project: string;
	config?: string;
}

export const featureCommand = new Command()
	.name("feature")
	.description(
		"Create a new VM for feature development with isolated backend branches",
	)
	.argument("<feature-name>", "Name of the feature branch to create")
	.requiredOption("--project <name>", "Project name (from hatch new)")
	.option(
		"-c, --config <path>",
		"Path to hatch.json config file",
		path.join(os.homedir(), ".hatch.json"),
	)
	.action(async (featureName: string, options: FeatureOptions) => {
		let vmName: string | undefined;
		let sshHost: string | undefined;
		let convexFeatureProjectId: string | undefined;

		try {
			log.blank();
			log.info(`Creating feature VM: ${featureName}`);
			log.info(`Project: ${options.project}`);
			log.blank();

			// Step 1: Look up project
			const project = await getProject(options.project);
			if (!project) {
				log.error(`Project not found: ${options.project}`);
				log.info("Run 'hatch list --projects' to see available projects.");
				log.info("Run 'hatch new <project-name>' to create a new project.");
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
				log.info("Run 'hatch config' to create a config file.");
				log.blank();
				process.exit(1);
			}

			// Check for stale tokens
			const shouldContinue = await checkAndPromptTokenRefresh(configPath);
			if (!shouldContinue) {
				log.info("Operation cancelled.");
				process.exit(0);
			}

			// Load config to get tokens for CLI commands
			let config = await fs.readJson(configPath);

			// Silently auto-refresh Claude token if expired
			if (isClaudeTokenExpired(config)) {
				const refreshed = await refreshClaudeTokenOnly(configPath);
				if (!refreshed) {
					log.error("Claude token expired. Run 'claude' to re-authenticate.");
					process.exit(1);
				}
				log.success("Claude token refreshed");
				// Reload config with fresh token
				config = await fs.readJson(configPath);
			}

			const supabaseToken = config.supabase?.token || "";
			const vercelToken = config.vercel?.token || "";
			const convexAccessToken = config.convex?.accessToken || "";
			const customEnvVars: EnvVar[] | undefined = config.envVars;
			const useConvex = project.backendProvider === "convex";

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
			const portSpinner = createSpinner("Configuring web preview port").start();
			try {
				await exeDevSharePort(vmName, 3000);
				portSpinner.succeed("Web preview configured for port 3000");
			} catch {
				portSpinner.warn(
					`Could not configure port. Run manually: ssh exe.dev share port ${vmName} 3000`,
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
				// Stop spinner so streaming output is visible
				installSpinner.stop();
				log.blank();

				await sshExec(sshHost, installCommand, {
					timeoutMs: 10 * 60 * 1000,
					streamStderr: true,
				});

				log.blank();
				log.success("Feature VM setup complete");
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
			const envPrefix = useConvex
				? `export PATH="$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH" &&`
				: `export PATH="$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH" && export SUPABASE_ACCESS_TOKEN="${supabaseToken}" &&`;

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

			// Backend-specific setup: Convex feature projects OR Supabase branches
			let mainBranch = "";
			let testBranch = "";
			let convexFeatureProject:
				| {
						projectId: string;
						projectSlug: string;
						deploymentName: string;
						deploymentUrl: string;
						deployKey: string;
				  }
				| undefined;

			if (useConvex) {
				// Convex path: Create separate project via API (local), then deploy on VM
				if (!convexAccessToken) {
					throw new Error(
						"Convex access token not configured. Run 'hatch config' and configure Convex.",
					);
				}

				const appUrl = `https://${vmName}.exe.xyz`;

				// Local: Create Convex feature project via Management API
				convexFeatureProject = await createConvexFeatureProject(
					project.convex?.projectSlug || project.name,
					featureName,
					convexAccessToken,
					appUrl,
					false,
					customEnvVars,
				);
				convexFeatureProjectId = convexFeatureProject.projectId;

				// VM: Deploy code to the feature project using its deploy key
				const deploySpinner = createSpinner(
					"Deploying Convex schema to feature project",
				).start();
				try {
					await sshExec(
						sshHost,
						`${envPrefix} export CONVEX_DEPLOY_KEY="${convexFeatureProject.deployKey}" && cd ${projectPath}/apps/web && npx convex deploy --yes`,
					);
					deploySpinner.succeed("Convex schema deployed to feature project");
				} catch (error) {
					deploySpinner.fail("Failed to deploy Convex schema");
					throw error;
				}

				// VM: Seed the feature deployment
				const seedSpinner = createSpinner(
					"Seeding Convex feature deployment",
				).start();
				try {
					await sshExec(
						sshHost,
						`${envPrefix} export CONVEX_DEPLOY_KEY="${convexFeatureProject.deployKey}" && cd ${projectPath}/apps/web && npx convex run seed:seedData`,
					);
					seedSpinner.succeed("Convex feature deployment seeded");
				} catch {
					seedSpinner.warn(
						"Could not seed feature deployment. You may need to run seed manually.",
					);
				}

				// Pull Vercel env vars
				const vercelEnvSpinner = createSpinner(
					"Pulling environment variables from Vercel",
				).start();
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath}/apps/web && vercel link --yes --project ${project.vercel.projectId} --token "${vercelToken}" 2>&1 || true`,
				);
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath}/apps/web && vercel env pull .env.local --yes --environment=development --token "${vercelToken}" 2>&1 || true`,
				);
				const { stdout: envCheck } = await sshExec(
					sshHost,
					`test -f $HOME/${project.github.repo}/apps/web/.env.local && echo "exists" || echo "missing"`,
				);
				if (envCheck.trim() === "exists") {
					vercelEnvSpinner.succeed("Environment variables pulled from Vercel");
				} else {
					vercelEnvSpinner.warn(
						"Could not pull env from Vercel. You may need to create .env.local manually.",
					);
				}

				// Append ALLOWED_DEV_ORIGINS after env pull so it doesn't get overwritten
				const exeDevOrigin = `${vmName}.exe.xyz`;
				await sshExec(
					sshHost,
					`cd ${projectPath}/apps/web && echo 'ALLOWED_DEV_ORIGINS=${exeDevOrigin}' >> .env.local`,
				);

				// Update .env.local with feature project URL and app URLs
				const convexEnvSpinner = createSpinner(
					"Configuring Convex environment variables",
				).start();
				try {
					const siteUrl = convexFeatureProject.deploymentUrl.replace(
						".convex.cloud",
						".convex.site",
					);
					await sshExec(
						sshHost,
						`cd ${projectPath}/apps/web && (grep -q '^NEXT_PUBLIC_CONVEX_URL=' .env.local && sed -i 's|^NEXT_PUBLIC_CONVEX_URL=.*|NEXT_PUBLIC_CONVEX_URL=${convexFeatureProject.deploymentUrl}|' .env.local || echo 'NEXT_PUBLIC_CONVEX_URL=${convexFeatureProject.deploymentUrl}' >> .env.local)`,
					);
					await sshExec(
						sshHost,
						`cd ${projectPath}/apps/web && (grep -q '^NEXT_PUBLIC_CONVEX_SITE_URL=' .env.local && sed -i 's|^NEXT_PUBLIC_CONVEX_SITE_URL=.*|NEXT_PUBLIC_CONVEX_SITE_URL=${siteUrl}|' .env.local || echo 'NEXT_PUBLIC_CONVEX_SITE_URL=${siteUrl}' >> .env.local)`,
					);
					await sshExec(
						sshHost,
						`cd ${projectPath}/apps/web && (grep -q '^BETTER_AUTH_URL=' .env.local && sed -i 's|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=${appUrl}|' .env.local || echo 'BETTER_AUTH_URL=${appUrl}' >> .env.local)`,
					);
					await sshExec(
						sshHost,
						`cd ${projectPath}/apps/web && (grep -q '^NEXT_PUBLIC_APP_URL=' .env.local && sed -i 's|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=${appUrl}|' .env.local || echo 'NEXT_PUBLIC_APP_URL=${appUrl}' >> .env.local)`,
					);
					convexEnvSpinner.succeed("Convex environment configured");
				} catch {
					convexEnvSpinner.warn(
						"Could not configure Convex env vars automatically. You may need to update .env.local manually.",
					);
				}
			} else {
				// Supabase path: Link project and create branches
				const linkSpinner = createSpinner("Linking Supabase project").start();
				try {
					await sshExec(
						sshHost,
						`${envPrefix} cd ${projectPath} && supabase link --project-ref ${project.supabase?.projectRef}`,
					);
					linkSpinner.succeed(
						`Supabase project linked: ${project.supabase?.projectRef}`,
					);
				} catch (error) {
					linkSpinner.fail("Failed to link Supabase project");
					throw error;
				}

				mainBranch = featureName;
				testBranch = `${featureName}-test`;

				const supabaseSpinner = createSpinner(
					"Creating Supabase branches",
				).start();
				try {
					await sshExec(
						sshHost,
						`${envPrefix} cd ${projectPath} && supabase branches create ${mainBranch} --persistent`,
					);
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

				// Pull Vercel environment variables to create .env.local
				const vercelEnvSpinner = createSpinner(
					"Pulling environment variables from Vercel",
				).start();
				const { stdout: linkOut, stderr: linkErr } = await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath}/apps/web && vercel link --yes --project ${project.vercel.projectId} --token "${vercelToken}" 2>&1 || true`,
				);
				console.log(
					`[DEBUG] vercel link - stdout: "${linkOut}", stderr: "${linkErr}"`,
				);
				const { stdout: pullOut, stderr: pullErr } = await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath}/apps/web && vercel env pull .env.local --yes --environment=development --token "${vercelToken}" 2>&1 || true`,
				);
				console.log(
					`[DEBUG] vercel env pull - stdout: "${pullOut}", stderr: "${pullErr}"`,
				);
				const { stdout: envCheck, stderr: envCheckErr } = await sshExec(
					sshHost,
					`test -f $HOME/${project.github.repo}/apps/web/.env.local && echo "exists" || echo "missing"`,
				);
				const checkResult = envCheck.trim();
				console.log(
					`[DEBUG] .env.local check - stdout: "${checkResult}", stderr: "${envCheckErr}"`,
				);
				if (checkResult === "exists") {
					vercelEnvSpinner.succeed("Environment variables pulled from Vercel");
				} else {
					vercelEnvSpinner.warn(
						`Could not pull env from Vercel (check returned: "${checkResult}"). You may need to create .env.local manually.`,
					);
				}

				// Append ALLOWED_DEV_ORIGINS after env pull so it doesn't get overwritten
				const exeDevOrigin = `${vmName}.exe.xyz`;
				await sshExec(
					sshHost,
					`cd ${projectPath}/apps/web && echo 'ALLOWED_DEV_ORIGINS=${exeDevOrigin}' >> .env.local`,
				);

				// Wait for branches to provision and get credentials
				const credSpinner = createSpinner(
					"Waiting for Supabase branches to provision",
				).start();
				try {
					await new Promise((resolve) => setTimeout(resolve, 45000));

					let mainDbUrl: string | undefined;
					let testDbUrl: string | undefined;

					const { stdout: mainOutput } = await sshExec(
						sshHost,
						`${envPrefix} cd ${projectPath} && supabase branches get ${mainBranch} -o env 2>/dev/null || echo ''`,
					);
					const mainMatch = mainOutput.match(/POSTGRES_URL="?([^"\n]+)"?/);
					if (mainMatch?.[1]) {
						mainDbUrl = mainMatch[1];
					}

					const { stdout: testOutput } = await sshExec(
						sshHost,
						`${envPrefix} cd ${projectPath} && supabase branches get ${testBranch} -o env 2>/dev/null || echo ''`,
					);
					const testMatch = testOutput.match(/POSTGRES_URL="?([^"\n]+)"?/);
					if (testMatch?.[1]) {
						testDbUrl = testMatch[1];
					}

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
				supabaseBranches: useConvex ? [] : [mainBranch, testBranch],
				githubBranch: featureName,
				backendProvider: project.backendProvider,
				...(useConvex && convexFeatureProject ? { convexFeatureProject } : {}),
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
			if (useConvex && convexFeatureProject) {
				log.step(`Convex project:  ${convexFeatureProject.projectSlug}`);
				log.step(`Convex URL:      ${convexFeatureProject.deploymentUrl}`);
			} else if (!useConvex) {
				log.step(`Supabase branch: ${mainBranch}`);
				log.step(`Test branch:     ${testBranch}`);
			}
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
			log.step(`hatch clean ${featureName} --project ${project.name}`);
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

			// Rollback: delete Convex feature project if it was created
			if (convexFeatureProjectId) {
				log.info("Rolling back: deleting Convex feature project...");
				try {
					const rollbackConfig = await fs.readJson(
						options.config || path.join(os.homedir(), ".hatch.json"),
					);
					await deleteConvexProject(
						convexFeatureProjectId,
						rollbackConfig.convex?.accessToken,
					);
					log.success("Convex feature project deleted");
				} catch {
					log.warn(
						"Failed to delete Convex feature project. Delete manually from the Convex dashboard.",
					);
				}
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
