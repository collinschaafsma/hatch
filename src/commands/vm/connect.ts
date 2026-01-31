import { select } from "@inquirer/prompts";
import { Command } from "commander";
import type { VMRecord } from "../../types/index.js";
import { log } from "../../utils/logger.js";
import { getProject } from "../../utils/project-store.js";
import { getVMByFeature, listVMs } from "../../utils/vm-store.js";

interface VMConnectOptions {
	project?: string;
}

export const vmConnectCommand = new Command()
	.name("connect")
	.description("Show connection info for a feature VM")
	.argument("[feature-name]", "Feature name (prompts if not specified)")
	.option("--project <name>", "Project name (prompts if not specified)")
	.action(async (featureName?: string, options?: VMConnectOptions) => {
		try {
			log.blank();

			let vmRecord: VMRecord | undefined;

			if (featureName && options?.project) {
				// Direct lookup by feature + project
				vmRecord = await getVMByFeature(options.project, featureName);
				if (!vmRecord) {
					log.error(
						`Feature VM not found: ${featureName} (project: ${options.project})`,
					);
					log.info("Run 'hatch vm list' to see available feature VMs.");
					process.exit(1);
				}
			} else {
				// Interactive selection
				const vms = await listVMs();

				if (vms.length === 0) {
					log.error("No feature VMs found.");
					log.info(
						"Run 'hatch vm feature <name> --project <project>' to create a feature VM.",
					);
					process.exit(1);
				}

				if (vms.length === 1) {
					vmRecord = vms[0];
				} else {
					const selectedName = await select({
						message: "Select a feature VM:",
						choices: vms.map((vm) => ({
							value: vm.name,
							name: `${vm.feature} (${vm.project}) - ${vm.name}`,
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
				project: projectName,
				feature,
				createdAt,
				supabaseBranches,
				githubBranch,
			} = vmRecord;

			// Get project details
			const project = await getProject(projectName);

			log.info(`Feature: ${feature}`);
			log.step(`Project:    ${projectName}`);
			log.step(`VM:         ${name}`);
			log.step(`Created:    ${new Date(createdAt).toLocaleString()}`);
			log.step(`Git branch: ${githubBranch}`);

			if (supabaseBranches.length > 0) {
				log.step(`Supabase:   ${supabaseBranches.join(", ")}`);
			}

			log.blank();
			log.info("Connect:");
			log.step(`SSH:     ssh ${sshHost}`);
			log.step(
				`VS Code: vscode://vscode-remote/ssh-remote+${sshHost}/home/exedev/${project?.github.repo || projectName}`,
			);
			log.step(`Web:     https://${name}.exe.xyz (once app runs on port 3000)`);
			log.blank();
			log.info("To start working:");
			log.step(`ssh ${sshHost}`);
			log.step(`cd ~/${project?.github.repo || projectName} && claude`);
			log.blank();
			log.info("When done:");
			log.step(`hatch vm clean ${feature} --project ${projectName}`);
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
