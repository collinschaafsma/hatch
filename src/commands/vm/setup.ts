import os from "node:os";
import path from "node:path";
import { input, select } from "@inquirer/prompts";
import { Command } from "commander";
import fs from "fs-extra";
import type { VMRecord } from "../../types/index.js";
import { exeDevList } from "../../utils/exe-dev.js";
import { log } from "../../utils/logger.js";
import { createSpinner } from "../../utils/spinner.js";
import { scpToRemote, sshExec } from "../../utils/ssh.js";
import { addVM, getVM } from "../../utils/vm-store.js";

interface VMSetupOptions {
	config?: string;
	workos?: boolean;
}

export const vmSetupCommand = new Command()
	.name("setup")
	.description("Set up a hatched project on an existing exe.dev VM")
	.argument("[vm-name]", "VM name (prompts if not specified)")
	.argument("[project-name]", "Project name (prompts if not specified)")
	.option(
		"-c, --config <path>",
		"Path to hatch.json config file",
		path.join(os.homedir(), ".hatch.json"),
	)
	.option("--workos", "Use WorkOS instead of Better Auth")
	.action(
		async (
			vmNameArg?: string,
			projectNameArg?: string,
			options?: VMSetupOptions,
		) => {
			try {
				log.blank();

				// Get VM name
				let vmName = vmNameArg;
				let sshHost: string;

				if (!vmName) {
					// List VMs from exe.dev and let user select
					const listSpinner = createSpinner("Fetching exe.dev VMs").start();
					const exeVMs = await exeDevList();
					listSpinner.succeed(`Found ${exeVMs.length} VM(s)`);

					if (exeVMs.length === 0) {
						log.error("No VMs found on exe.dev.");
						log.info("Create one with: ssh exe.dev new");
						process.exit(1);
					}

					vmName = await select({
						message: "Select a VM:",
						choices: exeVMs.map((vm) => ({
							value: vm.name,
							name: `${vm.name} (${vm.status})`,
						})),
					});
				}

				sshHost = `${vmName}.exe.xyz`;

				// Get project name
				let projectName = projectNameArg;
				if (!projectName) {
					projectName = await input({
						message: "Project name:",
						default: "my-app",
					});
				}

				log.blank();
				log.info(`Setting up project "${projectName}" on VM "${vmName}"`);
				log.blank();

				// Check config file exists
				const configPath =
					options?.config || path.join(os.homedir(), ".hatch.json");
				if (!(await fs.pathExists(configPath))) {
					log.error(`Config file not found: ${configPath}`);
					log.info("Run 'hatch config --global' to create a config file.");
					process.exit(1);
				}

				// Copy config file to VM
				const configSpinner = createSpinner(
					"Copying config file to VM",
				).start();
				await scpToRemote(configPath, sshHost, "~/.hatch.json");
				configSpinner.succeed("Config file copied");

				// Run install script on VM
				const installSpinner = createSpinner(
					"Running hatch install script on VM (this may take several minutes)",
				).start();

				const extraArgs = options?.workos ? "--workos" : "";
				const installCommand = `curl -fsSL https://raw.githubusercontent.com/collinschaafsma/hatch/main/scripts/install.sh | bash -s -- ${projectName} --config ~/.hatch.json ${extraArgs}`;

				try {
					// Install can take 5-10 minutes, use 15 minute timeout
					const result = await sshExec(sshHost, installCommand, {
						timeoutMs: 15 * 60 * 1000,
					});
					installSpinner.succeed("Project created on VM");

					// Show any warnings from the install
					if (result.stderr?.includes("warn")) {
						log.warn("Install completed with warnings - check VM for details");
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

				// Save/update VM in local tracking
				const existingVM = await getVM(vmName);
				const vmRecord: VMRecord = {
					name: vmName,
					sshHost,
					project: projectName,
					createdAt: existingVM?.createdAt || new Date().toISOString(),
					supabaseBranches: existingVM?.supabaseBranches || [],
				};
				await addVM(vmRecord);

				// Print connection info
				log.blank();
				log.success("Project setup complete!");
				log.blank();
				log.info("Connection details:");
				log.step(`VM:      ${vmName}`);
				log.step(`Project: ${projectName}`);
				log.blank();
				log.info("Connect:");
				log.step(`SSH:     ssh ${sshHost}`);
				log.step(
					`VS Code: vscode://vscode-remote/ssh-remote+${sshHost}/home/exedev/${projectName}`,
				);
				log.step(
					`Web:     https://${vmName}.exe.xyz (once app runs on port 3000)`,
				);
				log.blank();
				log.info("To start Claude:");
				log.step(`ssh ${sshHost}`);
				log.step(`cd ~/${projectName} && claude`);
				log.blank();
				log.warn("Remember to run 'claude login' on the VM to authenticate.");
				log.blank();
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes("User force closed")
				) {
					log.blank();
					log.info("Operation cancelled.");
					process.exit(0);
				}
				log.blank();
				log.error(
					`Failed to setup project: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		},
	);
