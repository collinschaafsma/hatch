import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import fs from "fs-extra";
import { parseConvexDeployUrl } from "../headless/convex.js";
import type { VMRecord } from "../types/index.js";
import { resolveConfigPath } from "../utils/config-resolver.js";
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
	.option("-c, --config <path>", "Path to hatch.json config file")
	.action(async (featureName: string, options: FeatureOptions) => {
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

			// Resolve config file path
			const configPath = await resolveConfigPath({
				configPath: options.config,
				project: options.project,
			});
			if (!(await fs.pathExists(configPath))) {
				log.blank();
				log.error(`Config file not found: ${configPath}`);
				log.info("Run 'hatch config' to create a config file.");
				log.blank();
				process.exit(1);
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
			const envPrefix = `source ~/.profile 2>/dev/null; export PATH="$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH" &&`;

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

			const appUrl = `https://${vmName}.exe.xyz`;

			// Pull Vercel env vars (includes the preview deploy key as CONVEX_DEPLOY_KEY)
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

			// Deploy to Convex preview deployment using the preview deploy key from .env.local
			const deploySpinner = createSpinner(
				"Creating Convex preview deployment",
			).start();
			let convexPreviewDeployment:
				| { deploymentUrl: string; deploymentName: string }
				| undefined;
			try {
				// Verify we have a preview deploy key — never deploy with a prod key from a feature/spike branch
				const convexDeployCmd = `DEPLOY_KEY=$(grep '^CONVEX_DEPLOY_KEY=' .env.local | cut -d= -f2- | sed 's/^\"//;s/\"$//'); if [ -z "$DEPLOY_KEY" ]; then echo "ERROR: No CONVEX_DEPLOY_KEY found in .env.local" >&2; exit 1; elif echo "$DEPLOY_KEY" | grep -q '^preview:'; then npx convex deploy --preview-create ${featureName} --yes 2>&1; else echo "ERROR: CONVEX_DEPLOY_KEY is a production key. Feature/spike branches must use a preview deploy key (starts with preview:). Set a preview deploy key in Vercel env vars as CONVEX_DEPLOY_KEY for the Preview environment." >&2; exit 1; fi`;
				const { stdout: deployOutput } = await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath}/apps/web && ${convexDeployCmd}`,
				);
				convexPreviewDeployment = parseConvexDeployUrl(deployOutput);
				if (convexPreviewDeployment) {
					deploySpinner.succeed(
						`Convex preview deployment created: ${convexPreviewDeployment.deploymentName}`,
					);
				} else {
					deploySpinner.succeed("Convex preview deployment created");
				}
			} catch (error) {
				deploySpinner.fail("Failed to create Convex preview deployment");
				throw error;
			}

			// Update .env.local with preview deployment URL and app URLs
			const convexEnvSpinner = createSpinner(
				"Configuring Convex environment variables",
			).start();
			try {
				if (convexPreviewDeployment) {
					const siteUrl = convexPreviewDeployment.deploymentUrl.replace(
						".convex.cloud",
						".convex.site",
					);
					await sshExec(
						sshHost,
						`cd ${projectPath}/apps/web && (grep -q '^NEXT_PUBLIC_CONVEX_URL=' .env.local && sed -i 's|^NEXT_PUBLIC_CONVEX_URL=.*|NEXT_PUBLIC_CONVEX_URL=${convexPreviewDeployment.deploymentUrl}|' .env.local || echo 'NEXT_PUBLIC_CONVEX_URL=${convexPreviewDeployment.deploymentUrl}' >> .env.local)`,
					);
					await sshExec(
						sshHost,
						`cd ${projectPath}/apps/web && (grep -q '^NEXT_PUBLIC_CONVEX_SITE_URL=' .env.local && sed -i 's|^NEXT_PUBLIC_CONVEX_SITE_URL=.*|NEXT_PUBLIC_CONVEX_SITE_URL=${siteUrl}|' .env.local || echo 'NEXT_PUBLIC_CONVEX_SITE_URL=${siteUrl}' >> .env.local)`,
					);
					await sshExec(
						sshHost,
						`cd ${projectPath}/apps/web && (grep -q '^CONVEX_DEPLOYMENT=' .env.local && sed -i 's|^CONVEX_DEPLOYMENT=.*|CONVEX_DEPLOYMENT=${convexPreviewDeployment.deploymentName}|' .env.local || echo 'CONVEX_DEPLOYMENT=${convexPreviewDeployment.deploymentName}' >> .env.local)`,
					);
				}
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

			// Seed the preview deployment
			const seedFunction = config.convex?.seedFunction || "seed:seedData";
			const seedSpinner = createSpinner(
				"Seeding Convex preview deployment",
			).start();
			try {
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath}/apps/web && npx convex run --preview-name ${featureName} ${seedFunction}`,
				);
				seedSpinner.succeed("Convex preview deployment seeded");
			} catch {
				seedSpinner.warn(
					"Could not seed preview deployment. You may need to run seed manually.",
				);
			}

			// Set HATCH_DEV_MODE on preview deployment for dev auth endpoint
			const devModeSpinner = createSpinner("Enabling dev auth mode").start();
			try {
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath}/apps/web && npx convex env set --preview-name ${featureName} HATCH_DEV_MODE true`,
				);
				devModeSpinner.succeed("Dev auth mode enabled");
			} catch {
				devModeSpinner.warn(
					"Could not set HATCH_DEV_MODE. Dev auth endpoint will not be available.",
				);
			}

			// Write .claude/settings.local.json with Convex MCP server config
			const mcpSpinner = createSpinner("Configuring Convex MCP server").start();
			try {
				// Read CONVEX_DEPLOY_KEY from .env.local on the VM
				const { stdout: deployKeyFromEnv } = await sshExec(
					sshHost,
					`cd ${projectPath}/apps/web && grep '^CONVEX_DEPLOY_KEY=' .env.local | cut -d= -f2- | sed 's/^\"//;s/\"$//'`,
				);
				const deployKey = deployKeyFromEnv.trim();
				const deploymentName = convexPreviewDeployment?.deploymentName || "";
				const mcpConfig = JSON.stringify(
					{
						mcpServers: {
							"convex-mcp": {
								command: "npx",
								args: ["-y", "@convex-dev/mcp-server"],
								env: {
									CONVEX_DEPLOYMENT: deploymentName,
									CONVEX_DEPLOY_KEY: deployKey,
								},
							},
						},
					},
					null,
					2,
				);
				await sshExec(
					sshHost,
					`mkdir -p ${projectPath}/.claude && cat > ${projectPath}/.claude/settings.local.json << 'MCPEOF'\n${mcpConfig}\nMCPEOF`,
				);
				mcpSpinner.succeed("Convex MCP server configured");
			} catch {
				mcpSpinner.warn(
					"Could not configure Convex MCP server. You can set it up manually.",
				);
			}

			// Push branch to origin
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

			// Save VM to local tracking
			const vmRecord: VMRecord = {
				name: vmName,
				sshHost,
				project: project.name,
				feature: featureName,
				createdAt: new Date().toISOString(),
				githubBranch: featureName,
				convexPreviewDeployment,
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
			if (convexPreviewDeployment) {
				log.step(`Convex preview:  ${convexPreviewDeployment.deploymentName}`);
				log.step(`Convex URL:      ${convexPreviewDeployment.deploymentUrl}`);
			}
			log.blank();
			log.info("Connect:");
			log.step(`SSH:     ssh ${sshHost}`);
			log.step(
				`VS Code: code --remote ssh-remote+${sshHost} /home/exedev/${project.github.repo}`,
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

			// Rollback: delete VM if it was created
			if (vmName) {
				log.info("Rolling back: deleting VM...");
				try {
					await exeDevRm(vmName);
					log.success("VM deleted");
				} catch {
					log.warn(
						`Failed to delete VM ${vmName}. Delete manually with: ssh exe.dev rm ${vmName}`,
					);
				}
			}

			process.exit(1);
		}
	});
