import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import fs from "fs-extra";
import type { HeadlessResult, ProjectRecord } from "../../types/index.js";
import {
	checkExeDevAccess,
	exeDevNew,
	exeDevRm,
	waitForVMReady,
} from "../../utils/exe-dev.js";
import { log } from "../../utils/logger.js";
import { saveProject } from "../../utils/project-store.js";
import { createSpinner } from "../../utils/spinner.js";
import { scpToRemote, sshExec } from "../../utils/ssh.js";
import { checkAndPromptTokenRefresh } from "../../utils/token-check.js";

interface VMNewOptions {
	config?: string;
	workos?: boolean;
}

export const vmNewCommand = new Command()
	.name("new")
	.description("Create a new project (VM is ephemeral, destroyed after setup)")
	.argument("<project-name>", "Name of the project to create")
	.option(
		"-c, --config <path>",
		"Path to hatch.json config file",
		path.join(os.homedir(), ".hatch.json"),
	)
	.option("--workos", "Use WorkOS instead of Better Auth")
	.action(async (projectName: string, options: VMNewOptions) => {
		let vmName: string | undefined;
		let sshHost: string | undefined;

		try {
			log.blank();
			log.info(`Creating project: ${projectName}`);
			log.blank();

			// Step 1: Check exe.dev access
			const accessSpinner = createSpinner(
				"Checking exe.dev SSH access",
			).start();
			const access = await checkExeDevAccess();

			if (!access.available) {
				accessSpinner.fail("Cannot connect to exe.dev");
				log.blank();
				log.error(access.error || "Unknown error");
				log.blank();
				log.info("To set up exe.dev SSH access:");
				log.step("1. Sign up at https://exe.dev");
				log.step("2. Add your SSH public key to your exe.dev account");
				log.step("3. Test with: ssh exe.dev");
				log.blank();
				process.exit(1);
			}
			accessSpinner.succeed("exe.dev SSH access confirmed");

			// Check config file exists
			const configPath =
				options.config || path.join(os.homedir(), ".hatch.json");
			if (!(await fs.pathExists(configPath))) {
				log.blank();
				log.error(`Config file not found: ${configPath}`);
				log.info("Run 'hatch config --global' to create a config file.");
				log.blank();
				process.exit(1);
			}

			// Check for stale tokens
			const shouldContinue = await checkAndPromptTokenRefresh(configPath);
			if (!shouldContinue) {
				log.info("Operation cancelled.");
				process.exit(0);
			}

			// Step 2: Create temporary VM
			const vmSpinner = createSpinner(
				"Creating temporary exe.dev VM for setup",
			).start();
			const vm = await exeDevNew();
			vmName = vm.name;
			sshHost = vm.sshHost;
			vmSpinner.succeed(`Temporary VM created: ${vmName}`);

			// Step 3: Wait for VM to be ready
			const readySpinner = createSpinner(
				`Waiting for VM to be ready (${sshHost})`,
			).start();
			await waitForVMReady(sshHost, 120000);
			readySpinner.succeed("VM is ready");

			// Step 4: Copy config file to VM
			const configSpinner = createSpinner("Copying config file to VM").start();
			await scpToRemote(configPath, sshHost, "~/.hatch.json");
			configSpinner.succeed("Config file copied");

			// Step 5: Run install script on VM with --json flag to capture output
			const installSpinner = createSpinner(
				"Running hatch install script on VM (this may take several minutes)",
			).start();

			const extraArgs = options.workos ? "--workos" : "";
			// Add --json flag to get structured output from headless create
			const installCommand = `curl -fsSL https://raw.githubusercontent.com/collinschaafsma/hatch/main/scripts/install.sh | bash -s -- ${projectName} --config ~/.hatch.json --json ${extraArgs}`;

			let headlessResult: HeadlessResult | undefined;

			try {
				// Stop spinner so streaming output is visible
				installSpinner.stop();
				log.blank();

				// Install can take 5-10 minutes, use 15 minute timeout
				// Stream stderr so progress is visible in real-time
				const result = await sshExec(sshHost, installCommand, {
					timeoutMs: 15 * 60 * 1000,
					streamStderr: true,
				});

				log.blank();
				log.success("Project created on VM");

				// Parse JSON output from the install script
				// The JSON is output at the end, so look for the last JSON object in stdout
				const jsonMatch = result.stdout.match(/\{[\s\S]*"success"[\s\S]*\}$/m);
				if (jsonMatch) {
					try {
						headlessResult = JSON.parse(jsonMatch[0]) as HeadlessResult;
					} catch {
						log.warn("Could not parse project creation output");
					}
				}

				// Show any warnings from the install
				if (result.stderr?.includes("warn")) {
					log.warn(
						"Install completed with warnings - check output for details",
					);
				}
			} catch (error) {
				installSpinner.fail("Failed to create project");
				// Show error output if available
				if (error instanceof Error && "stderr" in error) {
					const stderr = (error as { stderr?: string }).stderr;
					if (stderr) {
						log.error("Install script output:");
						console.log(stderr.slice(-2000)); // Last 2000 chars
					}
				}
				throw error;
			}

			// Step 6: Delete the temporary VM (ephemeral workflow)
			const cleanupSpinner = createSpinner("Cleaning up temporary VM").start();
			try {
				await exeDevRm(vmName);
				cleanupSpinner.succeed("Temporary VM deleted");
			} catch (cleanupError) {
				cleanupSpinner.warn(
					`Could not delete VM automatically. Delete manually: ssh exe.dev rm ${vmName}`,
				);
			}

			// Step 7: Save project to local store (if we have the details)
			if (
				headlessResult?.success &&
				headlessResult.github &&
				headlessResult.vercel &&
				headlessResult.supabase
			) {
				const projectRecord: ProjectRecord = {
					name: projectName,
					createdAt: new Date().toISOString(),
					github: {
						url: headlessResult.github.url,
						owner: headlessResult.github.owner,
						repo: headlessResult.github.repo,
					},
					vercel: {
						url: headlessResult.vercel.url,
						projectId: headlessResult.vercel.projectId,
					},
					supabase: {
						projectRef: headlessResult.supabase.projectRef,
						region: headlessResult.supabase.region,
					},
				};
				await saveProject(projectRecord);
			} else {
				log.warn(
					"Could not save full project details. You may need to look up URLs manually.",
				);
			}

			// Print project details
			log.blank();
			log.success("Project created successfully!");
			log.blank();

			if (headlessResult?.success) {
				log.info("Project details:");
				log.step(`Name:    ${projectName}`);
				if (headlessResult.github) {
					log.step(`GitHub:  ${headlessResult.github.url}`);
				}
				if (headlessResult.vercel) {
					log.step(`Vercel:  ${headlessResult.vercel.url}`);
				}
				if (headlessResult.supabase) {
					log.step(
						`Supabase: ${headlessResult.supabase.projectRef} (${headlessResult.supabase.region})`,
					);
				}
			} else {
				log.step(`Name: ${projectName}`);
			}

			log.blank();
			log.info("Next steps:");
			log.step(
				`Start a feature: hatch vm feature <feature-name> --project ${projectName}`,
			);
			log.blank();
		} catch (error) {
			log.blank();
			log.error(
				`Failed to create project: ${error instanceof Error ? error.message : error}`,
			);

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
