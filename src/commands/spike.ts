import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import fs from "fs-extra";
import type { SpikeResult, VMRecord } from "../types/index.js";
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
import { addVM, updateVM } from "../utils/vm-store.js";

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
}

export const spikeCommand = new Command()
	.name("spike")
	.description(
		"Create a feature VM and run Claude Agent SDK autonomously to implement a feature",
	)
	.argument("<feature-name>", "Name of the feature to build")
	.requiredOption("--project <name>", "Project name (from hatch list)")
	.requiredOption("--prompt <instructions>", "Instructions for Claude")
	.option(
		"-c, --config <path>",
		"Path to hatch.json config file",
		path.join(os.homedir(), ".hatch.json"),
	)
	.option("--timeout <minutes>", "Maximum build time in minutes", "60")
	.option("--wait", "Wait for completion instead of running in background")
	.option("--json", "Output result as JSON")
	.action(async (featureName: string, options: SpikeCommandOptions) => {
		let vmName: string | undefined;
		let sshHost: string | undefined;

		const outputJson = (result: SpikeResult) => {
			if (options.json) {
				console.log(JSON.stringify(result, null, 2));
			}
		};

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

			// Check config file exists and load it
			const configPath =
				options.config || path.join(os.homedir(), ".hatch.json");
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

			// Check for stale tokens (only in interactive mode)
			if (!options.json) {
				const shouldContinue = await checkAndPromptTokenRefresh(configPath);
				if (!shouldContinue) {
					log.info("Operation cancelled.");
					process.exit(0);
				}
			}

			// Load config to get tokens
			const config = await fs.readJson(configPath);
			const supabaseToken = config.supabase?.token || "";
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
			const envPrefix = `export PATH="$HOME/.local/bin:$HOME/.local/share/pnpm:$HOME/.claude/local/bin:$PATH" && export SUPABASE_ACCESS_TOKEN="${supabaseToken}" &&`;

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

			// Step 9: Configure Next.js for exe.dev preview
			const nextConfigSpinner = options.json
				? null
				: createSpinner("Configuring Next.js for exe.dev preview").start();
			try {
				const exeDevOrigin = `${vmName}.exe.xyz`;
				await sshExec(
					sshHost,
					`cd ${projectPath}/apps/web && echo 'ALLOWED_DEV_ORIGINS=${exeDevOrigin}' >> .env.local`,
				);
				nextConfigSpinner?.succeed("Next.js configured for exe.dev preview");
			} catch {
				nextConfigSpinner?.warn(
					"Could not configure allowedDevOrigins. You may see cross-origin warnings.",
				);
			}

			// Step 10: Link Supabase project
			const linkSpinner = options.json
				? null
				: createSpinner("Linking Supabase project").start();
			try {
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath} && supabase link --project-ref ${project.supabase.projectRef}`,
				);
				linkSpinner?.succeed(
					`Supabase project linked: ${project.supabase.projectRef}`,
				);
			} catch (error) {
				linkSpinner?.fail("Failed to link Supabase project");
				throw error;
			}

			// Step 11: Create Supabase branches
			const mainBranch = featureName;
			const testBranch = `${featureName}-test`;

			const supabaseSpinner = options.json
				? null
				: createSpinner("Creating Supabase branches").start();
			try {
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath} && supabase branches create ${mainBranch} --persistent`,
				);
				await sshExec(
					sshHost,
					`${envPrefix} cd ${projectPath} && supabase branches create ${testBranch} --persistent`,
				);
				supabaseSpinner?.succeed(
					`Supabase branches created: ${mainBranch}, ${testBranch}`,
				);
			} catch (error) {
				supabaseSpinner?.fail("Failed to create Supabase branches");
				throw error;
			}

			// Step 12: Pull Vercel environment variables
			const vercelEnvSpinner = options.json
				? null
				: createSpinner("Pulling environment variables from Vercel").start();
			await sshExec(
				sshHost,
				`${envPrefix} cd ${projectPath}/apps/web && vercel link --yes --project ${project.vercel.projectId} --token "${vercelToken}" 2>&1 || true`,
			);
			await sshExec(
				sshHost,
				`${envPrefix} cd ${projectPath}/apps/web && vercel env pull .env.local --environment=development --token "${vercelToken}" 2>&1 || true`,
			);
			const { stdout: envCheck } = await sshExec(
				sshHost,
				`test -f $HOME/${project.github.repo}/apps/web/.env.local && echo "exists" || echo "missing"`,
			);
			if (envCheck.trim() === "exists") {
				vercelEnvSpinner?.succeed("Environment variables pulled from Vercel");
			} else {
				vercelEnvSpinner?.warn(
					"Could not pull env from Vercel. You may need to create .env.local manually.",
				);
			}

			// Step 13: Wait for branches to provision and get credentials
			const credSpinner = options.json
				? null
				: createSpinner("Waiting for Supabase branches to provision").start();
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
					credSpinner?.succeed(
						`Branch credentials configured (DATABASE_URL${testDbUrl ? " + TEST_DATABASE_URL" : ""})`,
					);
				} else {
					credSpinner?.warn(
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
				credSpinner?.warn(
					"Could not configure branch credentials automatically. You may need to update .env.local manually.",
				);
			}

			// Step 14: Install Claude Agent SDK and tsx
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

			// Step 15: Copy agent runner script to VM (into project so it finds node_modules)
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

			// Ensure gitignore entry exists (for projects created before this was in the template)
			await sshExec(
				sshHost,
				`cd ${projectPath} && grep -q '^agent-runner.ts$' .gitignore 2>/dev/null || echo 'agent-runner.ts' >> .gitignore`,
			);
			agentScriptSpinner?.succeed("Agent runner script copied");

			// Step 16: Save VM to local tracking (before starting agent)
			const vmRecord: VMRecord = {
				name: vmName,
				sshHost,
				project: project.name,
				feature: featureName,
				createdAt: new Date().toISOString(),
				supabaseBranches: [mainBranch, testBranch],
				githubBranch: featureName,
				spikeStatus: "running",
			};
			await addVM(vmRecord);

			// Step 17: Start agent in background
			const agentSpinner = options.json
				? null
				: createSpinner("Starting Claude agent").start();

			// Escape the prompt for shell
			const escapedPrompt = options.prompt
				.replace(/\\/g, "\\\\")
				.replace(/"/g, '\\"')
				.replace(/\$/g, "\\$")
				.replace(/`/g, "\\`");

			// Use nohup to run agent in background (use pnpm tsx since we installed it)
			// Wrap in subshell and redirect stdin to fully detach from SSH
			const agentCommand = `${envPrefix} cd ${projectPath} && (nohup pnpm tsx ./agent-runner.ts --prompt "${escapedPrompt}" --project-path ${projectPath} --feature ${featureName} > /dev/null 2>&1 < /dev/null &)`;

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
