import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import fs from "fs-extra";
import { parseConvexDeployUrl } from "../headless/convex.js";
import type { SpikeResult, VMRecord } from "../types/index.js";
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
import { addVM, getVM, updateVM } from "../utils/vm-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "../..");

interface SpikeCommandOptions {
	project: string;
	prompt: string;
	config?: string;
	timeout?: number;
	wait?: boolean;
	json?: boolean;
	continue?: string;
	plan?: boolean;
}

/**
 * Handle spike continuation (--continue flag)
 * Reuses existing VM to add additional commits to the same PR
 */
async function handleContinuation(
	featureName: string,
	options: SpikeCommandOptions,
	continueVmName: string,
	outputJson: (result: SpikeResult) => void,
): Promise<void> {
	try {
		if (!options.json) {
			log.blank();
			log.info(`Continuing spike on VM: ${continueVmName}`);
			log.info(`Project: ${options.project}`);
			log.info(`Prompt: "${options.prompt}"`);
			log.blank();
		}

		// Step 1: Look up the VM
		const vm = await getVM(continueVmName);
		if (!vm) {
			const result: SpikeResult = {
				status: "failed",
				vmName: continueVmName,
				sshHost: "",
				feature: featureName,
				project: options.project,
				error: `VM not found: ${continueVmName}`,
			};
			outputJson(result);
			if (!options.json) {
				log.error(`VM not found: ${continueVmName}`);
				log.info("Run 'hatch list --json' to see available VMs.");
			}
			process.exit(1);
		}

		// Validate VM state
		if (vm.spikeStatus === "running") {
			const result: SpikeResult = {
				status: "failed",
				vmName: continueVmName,
				sshHost: vm.sshHost,
				feature: vm.feature,
				project: vm.project,
				error: "Spike is still running. Wait for it to complete first.",
			};
			outputJson(result);
			if (!options.json) {
				log.error("Spike is still running. Wait for it to complete first.");
				log.info(`Monitor with: ssh ${vm.sshHost} 'tail -f ~/spike.log'`);
			}
			process.exit(1);
		}

		if (vm.spikeStatus !== "completed") {
			const result: SpikeResult = {
				status: "failed",
				vmName: continueVmName,
				sshHost: vm.sshHost,
				feature: vm.feature,
				project: vm.project,
				error: `Spike status is "${vm.spikeStatus}". Can only continue completed spikes.`,
			};
			outputJson(result);
			if (!options.json) {
				log.error(
					`Spike status is "${vm.spikeStatus}". Can only continue completed spikes.`,
				);
			}
			process.exit(1);
		}

		// Step 2: Check SSH is still accessible
		const accessSpinner = options.json
			? null
			: createSpinner("Checking VM is still accessible").start();

		try {
			await sshExec(vm.sshHost, "echo ok", { timeoutMs: 10000 });
			accessSpinner?.succeed("VM is accessible");
		} catch {
			accessSpinner?.fail("VM is not accessible");
			const result: SpikeResult = {
				status: "failed",
				vmName: continueVmName,
				sshHost: vm.sshHost,
				feature: vm.feature,
				project: vm.project,
				error:
					"Cannot connect to VM. It may have been deleted. Start a new spike instead.",
			};
			outputJson(result);
			if (!options.json) {
				log.error(
					"Cannot connect to VM. It may have been deleted. Start a new spike instead.",
				);
			}
			process.exit(1);
		}

		// Step 3: Load and refresh config
		const configPath = await resolveConfigPath({
			configPath: options.config,
			project: options.project,
		});
		if (!(await fs.pathExists(configPath))) {
			const result: SpikeResult = {
				status: "failed",
				vmName: continueVmName,
				sshHost: vm.sshHost,
				feature: vm.feature,
				project: vm.project,
				error: `Config file not found: ${configPath}`,
			};
			outputJson(result);
			if (!options.json) {
				log.error(`Config file not found: ${configPath}`);
			}
			process.exit(1);
		}

		let config = await fs.readJson(configPath);

		// Auto-refresh Claude token if expired
		if (isClaudeTokenExpired(config)) {
			const refreshed = await refreshClaudeTokenOnly(configPath);
			if (!refreshed) {
				const result: SpikeResult = {
					status: "failed",
					vmName: continueVmName,
					sshHost: vm.sshHost,
					feature: vm.feature,
					project: vm.project,
					error: "Claude token expired. Run 'claude' to re-authenticate.",
				};
				outputJson(result);
				if (!options.json) {
					log.error("Claude token expired. Run 'claude' to re-authenticate.");
				}
				process.exit(1);
			}
			if (!options.json) {
				log.success("Claude token refreshed");
			}
			config = await fs.readJson(configPath);
		}

		// Step 4: Copy fresh config to VM (tokens may have refreshed)
		const configSpinner = options.json
			? null
			: createSpinner("Copying updated config to VM").start();
		await scpToRemote(configPath, vm.sshHost, "~/.hatch.json");
		configSpinner?.succeed("Config updated on VM");

		// Step 5: Look up project for path info
		const project = await getProject(vm.project);
		if (!project) {
			const result: SpikeResult = {
				status: "failed",
				vmName: continueVmName,
				sshHost: vm.sshHost,
				feature: vm.feature,
				project: vm.project,
				error: `Project not found: ${vm.project}`,
			};
			outputJson(result);
			if (!options.json) {
				log.error(`Project not found: ${vm.project}`);
			}
			process.exit(1);
		}

		const projectPath = `~/${project.github.repo}`;
		const envPrefix = `export PATH="$HOME/.local/bin:$HOME/.local/share/pnpm:$HOME/.claude/local/bin:$PATH" && export CONVEX_AGENT_MODE=anonymous && export CONVEX_DEPLOY_KEY="$(grep '^CONVEX_DEPLOY_KEY=' ${projectPath}/apps/web/.env.local | cut -d= -f2- | sed 's/^\"//;s/\"$//')" &&`;

		// Step 6: Update VM record to running
		const currentIteration = (vm.spikeIterations || 1) + 1;
		await updateVM(continueVmName, {
			spikeStatus: "running",
			spikeIterations: currentIteration,
		});

		// Step 7: Clear the done file so we can track new completion
		await sshExec(vm.sshHost, "rm -f ~/spike-done ~/spike-result.json");

		// Step 8: Start agent in background
		const agentSpinner = options.json
			? null
			: createSpinner(
					`Starting Claude agent (iteration ${currentIteration})`,
				).start();

		const escapedPrompt = options.prompt
			.replace(/\\/g, "\\\\")
			.replace(/"/g, '\\"')
			.replace(/\$/g, "\\$")
			.replace(/`/g, "\\`");

		const planEnv = options.plan
			? `export HATCH_PLAN=true && export HATCH_SPIKE_NAME="${vm.feature}" && `
			: "";
		const agentCommand = `${envPrefix} ${planEnv}cd ${projectPath} && (nohup pnpm tsx ./agent-runner.ts --prompt "${escapedPrompt}" --project-path ${projectPath} --feature ${vm.feature} --project ${vm.project} > /dev/null 2>&1 < /dev/null &)`;

		await sshExec(vm.sshHost, agentCommand);
		agentSpinner?.succeed(
			`Claude agent started (iteration ${currentIteration})`,
		);

		// Build the result
		const result: SpikeResult = {
			status: "started",
			vmName: continueVmName,
			sshHost: vm.sshHost,
			feature: vm.feature,
			project: vm.project,
			monitor: {
				tailLog: `ssh ${vm.sshHost} 'tail -f ~/spike.log'`,
				tailProgress: `ssh ${vm.sshHost} 'tail -f ~/spike-progress.jsonl'`,
				checkDone: `ssh ${vm.sshHost} 'test -f ~/spike-done && cat ~/spike-result.json'`,
			},
		};

		if (options.wait) {
			// Wait for completion
			const waitSpinner = options.json
				? null
				: createSpinner("Waiting for Claude agent to finish").start();

			const timeoutMinutes = Number.parseInt(
				options.timeout?.toString() || "60",
				10,
			);
			const timeoutMs = timeoutMinutes * 60 * 1000;
			const startTime = Date.now();
			const pollInterval = 30000;

			let completed = false;
			while (Date.now() - startTime < timeoutMs) {
				try {
					const { stdout } = await sshExec(
						vm.sshHost,
						"test -f ~/spike-done && echo 'done' || echo 'running'",
					);
					if (stdout.trim() === "done") {
						completed = true;
						break;
					}
				} catch {
					// Continue waiting
				}
				await new Promise((resolve) => setTimeout(resolve, pollInterval));
			}

			if (completed) {
				try {
					const { stdout: resultJson } = await sshExec(
						vm.sshHost,
						"cat ~/spike-result.json 2>/dev/null || echo '{}'",
					);
					const spikeResult = JSON.parse(resultJson);

					const { stdout: prUrl } = await sshExec(
						vm.sshHost,
						"cat ~/pr-url.txt 2>/dev/null || echo ''",
					);

					result.status = spikeResult.status || "completed";
					result.sessionId = spikeResult.sessionId;
					result.cost = spikeResult.cost;
					result.prUrl = prUrl.trim() || vm.prUrl || undefined;

					// Update VM record with cumulative cost
					const previousCost = vm.cumulativeCost || {
						totalUsd: 0,
						inputTokens: 0,
						outputTokens: 0,
					};
					const newCost = spikeResult.cost || {
						totalUsd: 0,
						inputTokens: 0,
						outputTokens: 0,
					};

					await updateVM(continueVmName, {
						spikeStatus: result.status === "completed" ? "completed" : "failed",
						agentSessionId: spikeResult.sessionId,
						prUrl: result.prUrl,
						cumulativeCost: {
							totalUsd: previousCost.totalUsd + newCost.totalUsd,
							inputTokens: previousCost.inputTokens + newCost.inputTokens,
							outputTokens: previousCost.outputTokens + newCost.outputTokens,
						},
					});

					waitSpinner?.succeed("Iteration completed");
				} catch {
					result.status = "completed";
					await updateVM(continueVmName, { spikeStatus: "completed" });
					waitSpinner?.succeed("Iteration completed (could not read result)");
				}
			} else {
				result.status = "failed";
				result.error = `Spike timed out after ${timeoutMinutes} minutes`;
				await updateVM(continueVmName, { spikeStatus: "failed" });
				waitSpinner?.fail(`Spike timed out after ${timeoutMinutes} minutes`);
			}
		}

		outputJson(result);

		if (!options.json) {
			log.blank();
			log.success(`Spike iteration ${currentIteration} started!`);
			log.blank();
			log.info("Spike details:");
			log.step(`VM:        ${continueVmName}`);
			log.step(`SSH:       ${vm.sshHost}`);
			log.step(`Feature:   ${vm.feature}`);
			log.step(`Project:   ${vm.project}`);
			log.step(`Iteration: ${currentIteration}`);
			log.blank();
			log.info("Monitor progress:");
			log.step(`Tail log:      ${result.monitor?.tailLog}`);
			log.step(`Tail progress: ${result.monitor?.tailProgress}`);
			log.step(`Check done:    ${result.monitor?.checkDone}`);
			log.blank();
			if (result.prUrl) {
				log.success(`PR URL: ${result.prUrl}`);
				log.blank();
			}
			if (result.cost) {
				log.info(
					`This iteration: $${result.cost.totalUsd.toFixed(4)} (${result.cost.inputTokens} in / ${result.cost.outputTokens} out)`,
				);
				log.blank();
			}
		}
	} catch (error) {
		if (error instanceof Error && error.message.includes("User force closed")) {
			if (!options.json) {
				log.blank();
				log.info("Operation cancelled.");
			}
		} else {
			const result: SpikeResult = {
				status: "failed",
				vmName: continueVmName,
				sshHost: "",
				feature: featureName,
				project: options.project,
				error: error instanceof Error ? error.message : String(error),
			};
			outputJson(result);

			if (!options.json) {
				log.blank();
				log.error(
					`Failed to continue spike: ${error instanceof Error ? error.message : error}`,
				);
			}
		}
		process.exit(1);
	}
}

export const spikeCommand = new Command()
	.name("spike")
	.description(
		"Create a feature VM and run Claude Agent SDK autonomously to implement a feature",
	)
	.argument("<feature-name>", "Name of the feature to build")
	.requiredOption("--project <name>", "Project name (from hatch list)")
	.requiredOption("--prompt <instructions>", "Instructions for Claude")
	.option("-c, --config <path>", "Path to hatch.json config file")
	.option("--timeout <minutes>", "Maximum build time in minutes", "240")
	.option("--wait", "Wait for completion instead of running in background")
	.option("--json", "Output result as JSON")
	.option("--plan", "Create an execution plan before coding")
	.option(
		"--continue <vm-name>",
		"Continue an existing spike on the specified VM",
	)
	.action(async (featureName: string, options: SpikeCommandOptions) => {
		let vmName: string | undefined;
		let sshHost: string | undefined;

		const outputJson = (result: SpikeResult) => {
			if (options.json) {
				console.log(JSON.stringify(result, null, 2));
			}
		};

		// Handle continuation mode
		if (options.continue) {
			await handleContinuation(
				featureName,
				options,
				options.continue,
				outputJson,
			);
			return;
		}

		try {
			if (!options.json) {
				log.blank();
				log.info(`Starting spike: ${featureName}`);
				log.info(`Project: ${options.project}`);
				log.info(`Prompt: "${options.prompt}"`);
				log.blank();
			}

			// Step 1: Look up project
			const project = await getProject(options.project);
			if (!project) {
				const result: SpikeResult = {
					status: "failed",
					vmName: "",
					sshHost: "",
					feature: featureName,
					project: options.project,
					error: `Project not found: ${options.project}`,
				};
				outputJson(result);
				if (!options.json) {
					log.error(`Project not found: ${options.project}`);
					log.info("Run 'hatch list --json' to see available projects.");
				}
				process.exit(1);
			}

			// Step 2: Check exe.dev access
			const accessSpinner = options.json
				? null
				: createSpinner("Checking exe.dev SSH access").start();
			const access = await checkExeDevAccess();

			if (!access.available) {
				accessSpinner?.fail("Cannot connect to exe.dev");
				const result: SpikeResult = {
					status: "failed",
					vmName: "",
					sshHost: "",
					feature: featureName,
					project: options.project,
					error: access.error || "Cannot connect to exe.dev",
				};
				outputJson(result);
				if (!options.json) {
					log.blank();
					log.error(access.error || "Unknown error");
				}
				process.exit(1);
			}
			accessSpinner?.succeed("exe.dev SSH access confirmed");

			// Resolve config file path
			const configPath = await resolveConfigPath({
				configPath: options.config,
				project: options.project,
			});
			if (!(await fs.pathExists(configPath))) {
				const result: SpikeResult = {
					status: "failed",
					vmName: "",
					sshHost: "",
					feature: featureName,
					project: options.project,
					error: `Config file not found: ${configPath}`,
				};
				outputJson(result);
				if (!options.json) {
					log.blank();
					log.error(`Config file not found: ${configPath}`);
					log.info("Run 'hatch config' to create a config file.");
					log.blank();
				}
				process.exit(1);
			}

			// Load config to get tokens
			let config = await fs.readJson(configPath);

			// Silently auto-refresh Claude token if expired
			if (isClaudeTokenExpired(config)) {
				const refreshed = await refreshClaudeTokenOnly(configPath);
				if (!refreshed) {
					const result: SpikeResult = {
						status: "failed",
						vmName: "",
						sshHost: "",
						feature: featureName,
						project: options.project,
						error: "Claude token expired. Run 'claude' to re-authenticate.",
					};
					outputJson(result);
					if (!options.json) {
						log.error("Claude token expired. Run 'claude' to re-authenticate.");
					}
					process.exit(1);
				}
				if (!options.json) {
					log.success("Claude token refreshed");
				}
				// Reload config with fresh token
				config = await fs.readJson(configPath);
			}

			const vercelToken = config.vercel?.token || "";

			// Step 3: Create new VM
			const vmSpinner = options.json
				? null
				: createSpinner("Creating exe.dev VM").start();
			const vm = await exeDevNew();
			vmName = vm.name;
			sshHost = vm.sshHost;
			vmSpinner?.succeed(`VM created: ${vmName}`);

			// Step 4: Wait for VM to be ready
			const readySpinner = options.json
				? null
				: createSpinner(`Waiting for VM to be ready (${sshHost})`).start();
			await waitForVMReady(sshHost, 120000);
			readySpinner?.succeed("VM is ready");

			// Step 5: Configure exe.dev to forward port 3000
			const portSpinner = options.json
				? null
				: createSpinner("Configuring web preview port").start();
			try {
				await exeDevSharePort(vmName, 3000);
				portSpinner?.succeed("Web preview configured for port 3000");
			} catch {
				portSpinner?.warn(
					`Could not configure port. Run manually: ssh exe.dev share port ${vmName} 3000`,
				);
			}

			// Step 6: Copy config file to VM
			const configSpinner = options.json
				? null
				: createSpinner("Copying config file to VM").start();
			await scpToRemote(configPath, sshHost, "~/.hatch.json");
			configSpinner?.succeed("Config file copied");

			// Step 7: Copy and run feature install script (same as hatch feature)
			const installSpinner = options.json
				? null
				: createSpinner(
						"Setting up feature VM (installing CLIs, cloning repo)",
					).start();

			const scriptPath = path.join(
				packageRoot,
				"scripts",
				"feature-install.sh",
			);
			if (!(await fs.pathExists(scriptPath))) {
				installSpinner?.fail("Feature install script not found");
				throw new Error("Feature install script not found");
			}

			await scpToRemote(scriptPath, sshHost, "~/feature-install.sh");
			const installCommand = `chmod +x ~/feature-install.sh && ~/feature-install.sh ${project.github.url} --config ~/.hatch.json`;

			try {
				installSpinner?.stop();
				if (!options.json) {
					log.blank();
				}

				await sshExec(sshHost, installCommand, {
					timeoutMs: 10 * 60 * 1000,
					streamStderr: !options.json,
				});

				if (!options.json) {
					log.blank();
					log.success("Feature VM setup complete");
				}
			} catch (error) {
				installSpinner?.fail("Failed to set up feature VM");
				throw error;
			}

			const projectPath = `~/${project.github.repo}`;
			const envPrefix = `export PATH="$HOME/.local/bin:$HOME/.local/share/pnpm:$HOME/.claude/local/bin:$PATH" &&`;

			// Step 8: Create git branch
			const gitSpinner = options.json
				? null
				: createSpinner("Creating git branch").start();
			try {
				await sshExec(
					sshHost,
					`cd ${projectPath} && git fetch origin && git checkout -b ${featureName} origin/main`,
				);
				gitSpinner?.succeed(`Git branch created: ${featureName}`);
			} catch (error) {
				gitSpinner?.fail("Failed to create git branch");
				throw error;
			}

			const appUrl = `https://${vmName}.exe.xyz`;

			// Pull Vercel env vars (includes the preview deploy key as CONVEX_DEPLOY_KEY)
			const vercelEnvSpinner = options.json
				? null
				: createSpinner("Pulling environment variables from Vercel").start();
			await sshExec(
				sshHost,
				`${envPrefix} cd ${projectPath}/apps/web && vercel link --yes --project ${project.vercel.projectId} --token "${vercelToken}" 2>&1 || true`,
			);
			await sshExec(
				sshHost,
				`${envPrefix} cd ${projectPath}/apps/web && vercel env pull .env.local --yes --environment=development --token "${vercelToken}" 2>&1 || true`,
			);
			const { stdout: envCheckConvex } = await sshExec(
				sshHost,
				`test -f $HOME/${project.github.repo}/apps/web/.env.local && echo "exists" || echo "missing"`,
			);
			if (envCheckConvex.trim() === "exists") {
				vercelEnvSpinner?.succeed("Environment variables pulled from Vercel");
			} else {
				vercelEnvSpinner?.warn(
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
			const deploySpinner = options.json
				? null
				: createSpinner("Creating Convex preview deployment").start();
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
					deploySpinner?.succeed(
						`Convex preview deployment created: ${convexPreviewDeployment.deploymentName}`,
					);
				} else {
					deploySpinner?.succeed("Convex preview deployment created");
				}
			} catch (error) {
				deploySpinner?.fail("Failed to create Convex preview deployment");
				throw error;
			}

			// Update .env.local with preview deployment URL and app URLs
			const convexEnvSpinner = options.json
				? null
				: createSpinner("Configuring Convex environment variables").start();
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
				}
				await sshExec(
					sshHost,
					`cd ${projectPath}/apps/web && (grep -q '^BETTER_AUTH_URL=' .env.local && sed -i 's|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=${appUrl}|' .env.local || echo 'BETTER_AUTH_URL=${appUrl}' >> .env.local)`,
				);
				await sshExec(
					sshHost,
					`cd ${projectPath}/apps/web && (grep -q '^NEXT_PUBLIC_APP_URL=' .env.local && sed -i 's|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=${appUrl}|' .env.local || echo 'NEXT_PUBLIC_APP_URL=${appUrl}' >> .env.local)`,
				);
				convexEnvSpinner?.succeed("Convex environment configured");
			} catch {
				convexEnvSpinner?.warn(
					"Could not configure Convex env vars automatically. You may need to update .env.local manually.",
				);
			}

			// Seed the preview deployment
			const seedSpinner = options.json
				? null
				: createSpinner("Seeding Convex preview deployment").start();
			try {
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath}/apps/web && npx convex run seed:seedData`,
				);
				seedSpinner?.succeed("Convex preview deployment seeded");
			} catch {
				seedSpinner?.warn(
					"Could not seed preview deployment. You may need to run seed manually.",
				);
			}

			// Write .claude/settings.local.json with Convex MCP server config
			const mcpSpinner = options.json
				? null
				: createSpinner("Configuring Convex MCP server").start();
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
				mcpSpinner?.succeed("Convex MCP server configured");
			} catch {
				mcpSpinner?.warn(
					"Could not configure Convex MCP server. You can set it up manually.",
				);
			}

			// Install Claude Agent SDK and tsx
			const sdkSpinner = options.json
				? null
				: createSpinner("Installing Claude Agent SDK").start();
			try {
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath} && pnpm add -wD @anthropic-ai/claude-agent-sdk tsx`,
				);
				sdkSpinner?.succeed("Claude Agent SDK installed");
			} catch (error) {
				sdkSpinner?.fail("Failed to install Claude Agent SDK");
				throw error;
			}

			// Copy agent runner script to VM
			const agentScriptSpinner = options.json
				? null
				: createSpinner("Copying agent runner script").start();
			const agentRunnerPath = path.join(
				packageRoot,
				"scripts",
				"agent-runner.ts",
			);
			if (!(await fs.pathExists(agentRunnerPath))) {
				agentScriptSpinner?.fail("Agent runner script not found");
				throw new Error("Agent runner script not found");
			}
			await scpToRemote(
				agentRunnerPath,
				sshHost,
				`${projectPath}/agent-runner.ts`,
			);

			// Ensure gitignore entry exists
			await sshExec(
				sshHost,
				`cd ${projectPath} && grep -q '^agent-runner.ts$' .gitignore 2>/dev/null || echo 'agent-runner.ts' >> .gitignore`,
			);
			agentScriptSpinner?.succeed("Agent runner script copied");

			// Push branch to origin
			const pushSpinner = options.json
				? null
				: createSpinner("Pushing branch to origin").start();
			try {
				await sshExec(
					sshHost,
					`cd ${projectPath} && git push -u origin ${featureName}`,
				);
				pushSpinner?.succeed("Branch pushed to origin");
			} catch (error) {
				pushSpinner?.fail("Failed to push branch");
				throw error;
			}

			// Save VM to local tracking (before starting agent)
			const vmRecord: VMRecord = {
				name: vmName,
				sshHost,
				project: project.name,
				feature: featureName,
				createdAt: new Date().toISOString(),
				githubBranch: featureName,
				convexPreviewDeployment,
				spikeStatus: "running",
				spikeIterations: 1,
				originalPrompt: options.prompt,
			};
			await addVM(vmRecord);

			// Start agent in background
			const agentSpinner = options.json
				? null
				: createSpinner("Starting Claude agent").start();

			// Escape the prompt for shell
			const escapedPrompt = options.prompt
				.replace(/\\/g, "\\\\")
				.replace(/"/g, '\\"')
				.replace(/\$/g, "\\$")
				.replace(/`/g, "\\`");

			// Read deploy key from .env.local and export for agent
			const convexDeployKeyExport = `export CONVEX_AGENT_MODE=anonymous && export CONVEX_DEPLOY_KEY="$(grep '^CONVEX_DEPLOY_KEY=' ${projectPath}/apps/web/.env.local | cut -d= -f2- | sed 's/^\"//;s/\"$//')" &&`;
			const planEnv = options.plan
				? `export HATCH_PLAN=true && export HATCH_SPIKE_NAME="${featureName}" && `
				: "";
			const agentCommand = `${envPrefix} ${convexDeployKeyExport} ${planEnv}cd ${projectPath} && (nohup pnpm tsx ./agent-runner.ts --prompt "${escapedPrompt}" --project-path ${projectPath} --feature ${featureName} --project ${project.name} > /dev/null 2>&1 < /dev/null &)`;

			await sshExec(sshHost, agentCommand);
			agentSpinner?.succeed("Claude agent started in background");

			// Build the result
			const result: SpikeResult = {
				status: "started",
				vmName,
				sshHost,
				feature: featureName,
				project: project.name,
				monitor: {
					tailLog: `ssh ${sshHost} 'tail -f ~/spike.log'`,
					tailProgress: `ssh ${sshHost} 'tail -f ~/spike-progress.jsonl'`,
					checkDone: `ssh ${sshHost} 'test -f ~/spike-done && cat ~/spike-result.json'`,
				},
			};

			if (options.wait) {
				// Wait for completion
				const waitSpinner = options.json
					? null
					: createSpinner("Waiting for Claude agent to finish").start();

				const timeoutMinutes = Number.parseInt(
					options.timeout?.toString() || "60",
					10,
				);
				const timeoutMs = timeoutMinutes * 60 * 1000;
				const startTime = Date.now();
				const pollInterval = 30000; // Check every 30 seconds

				let completed = false;
				while (Date.now() - startTime < timeoutMs) {
					try {
						const { stdout } = await sshExec(
							sshHost,
							"test -f ~/spike-done && echo 'done' || echo 'running'",
						);
						if (stdout.trim() === "done") {
							completed = true;
							break;
						}
					} catch {
						// Continue waiting
					}
					await new Promise((resolve) => setTimeout(resolve, pollInterval));
				}

				if (completed) {
					// Get the result file
					try {
						const { stdout: resultJson } = await sshExec(
							sshHost,
							"cat ~/spike-result.json 2>/dev/null || echo '{}'",
						);
						const spikeResult = JSON.parse(resultJson);

						// Get PR URL
						const { stdout: prUrl } = await sshExec(
							sshHost,
							"cat ~/pr-url.txt 2>/dev/null || echo ''",
						);

						result.status = spikeResult.status || "completed";
						result.sessionId = spikeResult.sessionId;
						result.cost = spikeResult.cost;
						result.prUrl = prUrl.trim() || undefined;

						// Update VM record
						await updateVM(vmName, {
							spikeStatus:
								result.status === "completed" ? "completed" : "failed",
							agentSessionId: spikeResult.sessionId,
							prUrl: result.prUrl,
							cumulativeCost: spikeResult.cost,
						});

						waitSpinner?.succeed("Spike completed");
					} catch {
						result.status = "completed";
						waitSpinner?.succeed("Spike completed (could not read result)");
					}
				} else {
					result.status = "failed";
					result.error = `Spike timed out after ${timeoutMinutes} minutes`;
					await updateVM(vmName, { spikeStatus: "failed" });
					waitSpinner?.fail(`Spike timed out after ${timeoutMinutes} minutes`);
				}
			}

			outputJson(result);

			if (!options.json) {
				log.blank();
				log.success("Spike started!");
				log.blank();
				log.info("Spike details:");
				log.step(`VM:      ${vmName}`);
				log.step(`SSH:     ${sshHost}`);
				log.step(`Feature: ${featureName}`);
				log.step(`Project: ${project.name}`);
				log.blank();
				log.info("Monitor progress:");
				log.step(`Tail log:      ${result.monitor?.tailLog}`);
				log.step(`Tail progress: ${result.monitor?.tailProgress}`);
				log.step(`Check done:    ${result.monitor?.checkDone}`);
				log.blank();
				if (result.prUrl) {
					log.success(`PR URL: ${result.prUrl}`);
					log.blank();
				}
				if (result.cost) {
					log.info(
						`Cost: $${result.cost.totalUsd.toFixed(4)} (${result.cost.inputTokens} in / ${result.cost.outputTokens} out)`,
					);
					log.blank();
				}
				log.info("When done:");
				log.step(`hatch clean ${featureName} --project ${project.name}`);
				log.blank();
			}
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("User force closed")
			) {
				if (!options.json) {
					log.blank();
					log.info("Operation cancelled.");
				}
			} else {
				const result: SpikeResult = {
					status: "failed",
					vmName: vmName || "",
					sshHost: sshHost || "",
					feature: featureName,
					project: options.project,
					error: error instanceof Error ? error.message : String(error),
				};
				outputJson(result);

				if (!options.json) {
					log.blank();
					log.error(
						`Failed to start spike: ${error instanceof Error ? error.message : error}`,
					);
				}
			}

			// Rollback: delete VM if it was created
			if (vmName) {
				if (!options.json) {
					log.info("Rolling back: deleting VM...");
				}
				try {
					await exeDevRm(vmName);
					if (!options.json) {
						log.success("VM deleted");
					}
				} catch {
					if (!options.json) {
						log.warn(
							`Failed to delete VM ${vmName}. Delete manually with: ssh exe.dev rm ${vmName}`,
						);
					}
				}
			}

			process.exit(1);
		}
	});
