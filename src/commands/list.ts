import { Command } from "commander";
import { log } from "../utils/logger.js";
import { listProjects } from "../utils/project-store.js";
import { listVMs, listVMsByProject } from "../utils/vm-store.js";

interface ListOptions {
	json?: boolean;
	projects?: boolean;
}

export const listCommand = new Command()
	.name("list")
	.description("List projects and feature VMs")
	.option("--json", "Output as JSON")
	.option("--projects", "Show only projects (no feature VMs)")
	.action(async (options: ListOptions) => {
		try {
			const projects = await listProjects();
			const vms = await listVMs();

			if (options.json) {
				if (options.projects) {
					console.log(JSON.stringify(projects, null, 2));
				} else {
					console.log(JSON.stringify({ projects, vms }, null, 2));
				}
				return;
			}

			log.blank();

			// Show projects only
			if (options.projects) {
				if (projects.length === 0) {
					log.info("No projects found.");
					log.info("Run 'hatch new <project-name>' to create a project.");
					log.blank();
					return;
				}

				log.info(
					`Found ${projects.length} project${projects.length === 1 ? "" : "s"}:`,
				);
				log.blank();

				for (const project of projects) {
					const createdDate = new Date(project.createdAt).toLocaleDateString();
					log.step(`${project.name}`);
					log.info(`  GitHub:   ${project.github.url}`);
					log.info(`  Vercel:   ${project.vercel.url}`);
					log.info(
						`  Supabase: ${project.supabase.projectRef} (${project.supabase.region})`,
					);
					log.info(`  Created:  ${createdDate}`);
					log.blank();
				}
				return;
			}

			// Show projects with their feature VMs grouped
			if (projects.length === 0 && vms.length === 0) {
				log.info("No projects or feature VMs found.");
				log.info("Run 'hatch new <project-name>' to create a project.");
				log.blank();
				return;
			}

			// Group VMs by project
			const vmsByProject = new Map<string, typeof vms>();
			for (const vm of vms) {
				const existing = vmsByProject.get(vm.project) || [];
				existing.push(vm);
				vmsByProject.set(vm.project, existing);
			}

			// Show projects with their VMs
			for (const project of projects) {
				const createdDate = new Date(project.createdAt).toLocaleDateString();
				const projectVMs = vmsByProject.get(project.name) || [];

				log.info(`Project: ${project.name}`);
				log.step(`GitHub:   ${project.github.url}`);
				log.step(`Vercel:   ${project.vercel.url}`);
				log.step(`Supabase: ${project.supabase.projectRef}`);
				log.step(`Created:  ${createdDate}`);

				if (projectVMs.length > 0) {
					log.blank();
					log.step(`Feature VMs (${projectVMs.length}):`);
					for (const vm of projectVMs) {
						const vmCreatedDate = new Date(vm.createdAt).toLocaleDateString();
						log.info(`    ${vm.feature} (${vm.name})`);
						log.info(`      SSH:      ssh ${vm.sshHost}`);
						log.info(`      Branch:   ${vm.githubBranch}`);
						log.info(`      Supabase: ${vm.supabaseBranches.join(", ")}`);
						log.info(`      Created:  ${vmCreatedDate}`);
					}
				} else {
					log.step("Feature VMs: none");
				}
				log.blank();

				// Remove from map so we can track orphaned VMs
				vmsByProject.delete(project.name);
			}

			// Show orphaned VMs (VMs whose projects no longer exist in the store)
			if (vmsByProject.size > 0) {
				log.warn("Orphaned VMs (project not in store):");
				for (const [projectName, orphanedVMs] of vmsByProject) {
					for (const vm of orphanedVMs) {
						log.step(
							`${vm.name} (project: ${projectName}, feature: ${vm.feature})`,
						);
						log.info(`  SSH: ssh ${vm.sshHost}`);
					}
				}
				log.blank();
			}
		} catch (error) {
			log.blank();
			log.error(
				`Failed to list: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
