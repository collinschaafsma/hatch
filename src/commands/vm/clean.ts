import { confirm } from "@inquirer/prompts";
import { Command } from "commander";
import { exeDevRm } from "../../utils/exe-dev.js";
import { log } from "../../utils/logger.js";
import { createSpinner } from "../../utils/spinner.js";
import { sshExec } from "../../utils/ssh.js";
import { getVM, removeVM } from "../../utils/vm-store.js";

interface VMCleanOptions {
	force?: boolean;
}

export const vmCleanCommand = new Command()
	.name("clean")
	.description("Clean up a VM and all associated resources")
	.argument("<vm-name>", "VM name to clean up")
	.option("-f, --force", "Skip confirmation prompt")
	.action(async (vmName: string, options: VMCleanOptions) => {
		try {
			log.blank();

			// Get VM record
			const vmRecord = await getVM(vmName);
			if (!vmRecord) {
				log.error(`VM not found in local tracking: ${vmName}`);
				log.info("Run 'hatch vm:list' to see tracked VMs.");
				log.blank();
				log.info("To delete an untracked VM directly:");
				log.step(`ssh exe.dev rm ${vmName}`);
				process.exit(1);
			}

			const { sshHost, project, feature, supabaseBranches } = vmRecord;

			// Show what will be deleted
			log.info(`VM: ${vmName}`);
			log.step(`Project: ${project}`);
			if (feature) {
				log.step(`Feature: ${feature}`);
			}
			if (supabaseBranches.length > 0) {
				log.step(`Supabase branches: ${supabaseBranches.join(", ")}`);
			}
			log.blank();

			// Confirm deletion
			if (!options.force) {
				const confirmed = await confirm({
					message: `Are you sure you want to delete VM "${vmName}" and all associated resources?`,
					default: false,
				});

				if (!confirmed) {
					log.info("Operation cancelled.");
					process.exit(0);
				}
			}

			log.blank();

			// Step 1: Delete Supabase branches
			if (supabaseBranches.length > 0) {
				const supabaseSpinner = createSpinner(
					"Deleting Supabase branches",
				).start();

				const deletedBranches: string[] = [];
				const failedBranches: string[] = [];

				for (const branch of supabaseBranches) {
					try {
						// First disable persistence, then delete
						await sshExec(
							sshHost,
							`cd ~/${project} && supabase branches update ${branch} --no-persistent 2>/dev/null || true`,
						);
						await sshExec(
							sshHost,
							`cd ~/${project} && supabase branches delete ${branch} --force 2>/dev/null || true`,
						);
						deletedBranches.push(branch);
					} catch {
						failedBranches.push(branch);
					}
				}

				if (failedBranches.length > 0) {
					supabaseSpinner.warn(
						`Deleted ${deletedBranches.length} branches, failed: ${failedBranches.join(", ")}`,
					);
				} else {
					supabaseSpinner.succeed(
						`Deleted ${deletedBranches.length} Supabase branches`,
					);
				}
			}

			// Step 2: Delete VM from exe.dev
			const vmSpinner = createSpinner("Deleting VM from exe.dev").start();
			try {
				await exeDevRm(vmName);
				vmSpinner.succeed("VM deleted from exe.dev");
			} catch (error) {
				vmSpinner.fail("Failed to delete VM from exe.dev");
				log.warn(`You may need to delete manually: ssh exe.dev rm ${vmName}`);
			}

			// Step 3: Remove from local tracking
			await removeVM(vmName);

			// Print summary
			log.blank();
			log.success("Cleanup complete!");
			log.blank();
			log.info("Deleted resources:");
			log.step(`VM: ${vmName}`);
			if (supabaseBranches.length > 0) {
				log.step(`Supabase branches: ${supabaseBranches.join(", ")}`);
			}
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
				`Failed to clean VM: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
