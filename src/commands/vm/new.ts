import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import fs from "fs-extra";
import type { VMRecord } from "../../types/index.js";
import {
	checkExeDevAccess,
	exeDevNew,
	exeDevRm,
	waitForVMReady,
} from "../../utils/exe-dev.js";
import { log } from "../../utils/logger.js";
import { createSpinner } from "../../utils/spinner.js";
import { scpToRemote, sshExec } from "../../utils/ssh.js";
import { addVM, removeVM } from "../../utils/vm-store.js";

interface VMNewOptions {
	config?: string;
	workos?: boolean;
}

export const vmNewCommand = new Command()
	.name("new")
	.description("Provision an exe.dev VM and create a new hatched project")
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
			log.info(`Creating VM for project: ${projectName}`);
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

			// Step 2: Create VM
			const vmSpinner = createSpinner("Creating exe.dev VM").start();
			const vm = await exeDevNew();
			vmName = vm.name;
			sshHost = vm.sshHost;
			vmSpinner.succeed(`VM created: ${vmName}`);

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

			// Step 5: Run install script on VM
			const installSpinner = createSpinner(
				"Running hatch install script on VM (this may take several minutes)",
			).start();

			const extraArgs = options.workos ? "--workos" : "";
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

			// Step 6: Save VM to local tracking
			const vmRecord: VMRecord = {
				name: vmName,
				sshHost,
				project: projectName,
				createdAt: new Date().toISOString(),
				supabaseBranches: [],
			};
			await addVM(vmRecord);

			// Print connection info
			log.blank();
			log.success("VM provisioned successfully!");
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
				`Web:     https://${sshHost.replace(".exe.xyz", "")}.exe.xyz (once app runs on port 3000)`,
			);
			log.blank();
			log.info("To start Claude:");
			log.step(`ssh ${sshHost}`);
			log.step(`cd ~/${projectName} && claude`);
			log.blank();
			log.warn("Remember to run 'claude login' on the VM to authenticate.");
			log.blank();
		} catch (error) {
			log.blank();
			log.error(
				`Failed to create VM: ${error instanceof Error ? error.message : error}`,
			);

			// Rollback: delete VM if it was created
			if (vmName) {
				log.info("Rolling back: deleting VM...");
				try {
					await exeDevRm(vmName);
					await removeVM(vmName);
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
