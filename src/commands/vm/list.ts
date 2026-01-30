import { Command } from "commander";
import { log } from "../../utils/logger.js";
import { listVMs } from "../../utils/vm-store.js";

interface VMListOptions {
	json?: boolean;
}

export const vmListCommand = new Command()
	.name("list")
	.description("List all exe.dev VMs")
	.option("--json", "Output as JSON")
	.action(async (options: VMListOptions) => {
		try {
			const vms = await listVMs();

			if (options.json) {
				console.log(JSON.stringify(vms, null, 2));
				return;
			}

			log.blank();

			if (vms.length === 0) {
				log.info("No VMs found.");
				log.info("Run 'hatch vm:new <project-name>' to create a VM.");
				log.blank();
				return;
			}

			log.info(`Found ${vms.length} VM${vms.length === 1 ? "" : "s"}:`);
			log.blank();

			for (const vm of vms) {
				const createdDate = new Date(vm.createdAt).toLocaleDateString();
				const featureInfo = vm.feature ? ` [feature: ${vm.feature}]` : "";

				log.step(`${vm.name} (${vm.project})${featureInfo}`);
				log.info(`  SSH:     ssh ${vm.sshHost}`);
				log.info(`  Created: ${createdDate}`);

				if (vm.githubBranch) {
					log.info(`  Branch:  ${vm.githubBranch}`);
				}

				if (vm.supabaseBranches.length > 0) {
					log.info(`  Supabase: ${vm.supabaseBranches.join(", ")}`);
				}

				log.blank();
			}
		} catch (error) {
			log.blank();
			log.error(
				`Failed to list VMs: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
