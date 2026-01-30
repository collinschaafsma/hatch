import { select } from "@inquirer/prompts";
import { Command } from "commander";
import type { VMRecord } from "../../types/index.js";
import { log } from "../../utils/logger.js";
import { getVM, listVMs } from "../../utils/vm-store.js";

export const vmConnectCommand = new Command()
	.name("connect")
	.description("Show connection info for a VM")
	.argument("[vm-name]", "VM name (prompts if not specified)")
	.action(async (vmName?: string) => {
		try {
			log.blank();

			let vmRecord: VMRecord | undefined;

			if (vmName) {
				vmRecord = await getVM(vmName);
				if (!vmRecord) {
					log.error(`VM not found: ${vmName}`);
					log.info("Run 'hatch vm:list' to see available VMs.");
					process.exit(1);
				}
			} else {
				// List VMs and prompt for selection
				const vms = await listVMs();

				if (vms.length === 0) {
					log.error("No VMs found.");
					log.info("Run 'hatch vm:new <project-name>' to create a VM first.");
					process.exit(1);
				}

				if (vms.length === 1) {
					vmRecord = vms[0];
				} else {
					const selectedName = await select({
						message: "Select a VM:",
						choices: vms.map((vm) => ({
							value: vm.name,
							name: `${vm.name} (${vm.project})${vm.feature ? ` [feature: ${vm.feature}]` : ""}`,
						})),
					});
					vmRecord = vms.find((v) => v.name === selectedName);
				}
			}

			if (!vmRecord) {
				log.error("No VM selected.");
				process.exit(1);
			}

			const {
				name,
				sshHost,
				project,
				feature,
				createdAt,
				supabaseBranches,
				githubBranch,
			} = vmRecord;

			log.info(`VM: ${name}`);
			log.step(`Project:    ${project}`);
			log.step(`Created:    ${new Date(createdAt).toLocaleString()}`);

			if (feature) {
				log.step(`Feature:    ${feature}`);
			}

			if (githubBranch) {
				log.step(`Git branch: ${githubBranch}`);
			}

			if (supabaseBranches.length > 0) {
				log.step(`Supabase:   ${supabaseBranches.join(", ")}`);
			}

			log.blank();
			log.info("Connect:");
			log.step(`SSH:     ssh ${sshHost}`);
			log.step(
				`VS Code: vscode://vscode-remote/ssh-remote+${sshHost}/home/exedev/${project}`,
			);
			log.step(`Web:     https://${name}.exe.xyz (once app runs on port 3000)`);
			log.blank();
			log.info("To start Claude:");
			log.step(`ssh ${sshHost}`);
			log.step(`cd ~/${project} && claude`);
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
				`Failed to get VM info: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
