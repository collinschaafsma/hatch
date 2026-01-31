import { confirm } from "@inquirer/prompts";
import { Command } from "commander";
import { exeDevRm } from "../../utils/exe-dev.js";
import { log } from "../../utils/logger.js";
import { getProject } from "../../utils/project-store.js";
import { createSpinner } from "../../utils/spinner.js";
import { sshExec } from "../../utils/ssh.js";
import { getVMByFeature, removeVM } from "../../utils/vm-store.js";

interface VMCleanOptions {
	project: string;
	force?: boolean;
}

export const vmCleanCommand = new Command()
	.name("clean")
	.description("Clean up a feature VM and its Supabase branches")
	.argument("<feature-name>", "Feature name to clean up")
	.requiredOption("--project <name>", "Project name")
	.option("-f, --force", "Skip confirmation prompt")
	.action(async (featureName: string, options: VMCleanOptions) => {
		try {
			log.blank();

			// Look up project
			const project = await getProject(options.project);
			if (!project) {
				log.error(`Project not found: ${options.project}`);
				log.info("Run 'hatch vm list --projects' to see available projects.");
				process.exit(1);
			}

			// Get VM by project + feature
			const vmRecord = await getVMByFeature(options.project, featureName);
			if (!vmRecord) {
				log.error(
					`Feature VM not found: ${featureName} (project: ${options.project})`,
				);
				log.info("Run 'hatch vm list' to see available feature VMs.");
				process.exit(1);
			}

			const { name: vmName, sshHost, supabaseBranches } = vmRecord;

			// Show what will be deleted
			log.info(`Feature: ${featureName}`);
			log.step(`Project: ${options.project}`);
			log.step(`VM: ${vmName}`);
			if (supabaseBranches.length > 0) {
				log.step(`Supabase branches: ${supabaseBranches.join(", ")}`);
			}
			log.blank();

			// Confirm deletion
			if (!options.force) {
				const confirmed = await confirm({
					message:
						"Are you sure you want to delete this feature VM and its Supabase branches?",
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
							`cd ~/${project.github.repo} && supabase branches update ${branch} --no-persistent 2>/dev/null || true`,
						);
						await sshExec(
							sshHost,
							`cd ~/${project.github.repo} && supabase branches delete ${branch} --force 2>/dev/null || true`,
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
			log.success("Feature cleanup complete!");
			log.blank();
			log.info("Deleted resources:");
			log.step(`VM: ${vmName}`);
			if (supabaseBranches.length > 0) {
				log.step(`Supabase branches: ${supabaseBranches.join(", ")}`);
			}
			log.blank();
			log.info("Project preserved:");
			log.step(`GitHub: ${project.github.url}`);
			log.step(`Vercel: ${project.vercel.url}`);
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
				`Failed to clean feature: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
