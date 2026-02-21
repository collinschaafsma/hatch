import { confirm } from "@inquirer/prompts";
import { Command } from "commander";
import fs from "fs-extra";
import { deleteConvexProject } from "../headless/convex.js";
import { deleteVercelBranchEnvVars } from "../headless/vercel.js";
import { exeDevRm } from "../utils/exe-dev.js";

import { resolveConfigPath } from "../utils/config-resolver.js";
import { log } from "../utils/logger.js";
import { getProject } from "../utils/project-store.js";
import { createSpinner } from "../utils/spinner.js";
import { getVMByFeature, removeVM } from "../utils/vm-store.js";

interface CleanOptions {
	project: string;
	force?: boolean;
	config?: string;
}

export const cleanCommand = new Command()
	.name("clean")
	.description("Clean up a feature VM and its Convex feature project")
	.argument("<feature-name>", "Feature name to clean up")
	.requiredOption("--project <name>", "Project name")
	.option("-f, --force", "Skip confirmation prompt")
	.option("-c, --config <path>", "Path to hatch.json config file")
	.action(async (featureName: string, options: CleanOptions) => {
		try {
			log.blank();

			// Look up project
			const project = await getProject(options.project);
			if (!project) {
				log.error(`Project not found: ${options.project}`);
				log.info("Run 'hatch list --projects' to see available projects.");
				process.exit(1);
			}

			// Get VM by project + feature
			const vmRecord = await getVMByFeature(options.project, featureName);
			if (!vmRecord) {
				log.error(
					`Feature VM not found: ${featureName} (project: ${options.project})`,
				);
				log.info("Run 'hatch list' to see available feature VMs.");
				process.exit(1);
			}

			// Resolve config path
			const configPath = await resolveConfigPath({
				configPath: options.config,
				project: options.project,
			});
			let githubToken = "";
			let convexAccessToken = "";
			let vercelToken = "";
			if (await fs.pathExists(configPath)) {
				const config = await fs.readJson(configPath);
				githubToken = config.github?.token || "";
				convexAccessToken = config.convex?.accessToken || "";
				vercelToken = config.vercel?.token || "";
			}

			const {
				name: vmName,
				githubBranch,
				convexFeatureProject,
				convexPreviewDeployment,
			} = vmRecord;

			// Show what will be deleted
			log.info(`Feature: ${featureName}`);
			log.step(`Project: ${options.project}`);
			log.step(`VM: ${vmName}`);
			if (githubBranch) {
				log.step(`Git branch: ${githubBranch}`);
			}
			if (convexPreviewDeployment) {
				log.step(`Convex preview: ${convexPreviewDeployment.deploymentName}`);
			} else if (convexFeatureProject) {
				log.step(`Convex project: ${convexFeatureProject.projectSlug}`);
			}
			log.blank();

			// Confirm deletion
			if (!options.force) {
				const confirmMessage = convexFeatureProject
					? "Are you sure you want to delete this feature VM and its Convex project?"
					: "Are you sure you want to delete this feature VM?";
				const confirmed = await confirm({
					message: confirmMessage,
					default: false,
				});

				if (!confirmed) {
					log.info("Operation cancelled.");
					process.exit(0);
				}
			}

			log.blank();

			// Step 1: Handle Convex cleanup
			if (convexPreviewDeployment) {
				// Preview deployment path: no project to delete, no branch env vars
				log.info(
					`Convex preview deployment "${convexPreviewDeployment.deploymentName}" will be cleaned up automatically.`,
				);
			} else if (convexFeatureProject) {
				// Legacy separate project path: delete the project
				const convexSpinner = createSpinner(
					"Deleting Convex feature project",
				).start();
				try {
					if (!convexAccessToken) {
						throw new Error("Convex access token not configured");
					}
					await deleteConvexProject(
						convexFeatureProject.projectId,
						convexAccessToken,
					);
					convexSpinner.succeed(
						`Deleted Convex project: ${convexFeatureProject.projectSlug}`,
					);
				} catch (error) {
					convexSpinner.warn(
						`Failed to delete Convex project: ${error instanceof Error ? error.message : error}. Delete manually from the Convex dashboard.`,
					);
				}
				// Clean up per-branch Vercel env vars (only for legacy path)
				if (vercelToken && githubBranch) {
					const vercelEnvSpinner = createSpinner(
						"Removing per-branch Vercel environment variables",
					).start();
					try {
						const deleted = await deleteVercelBranchEnvVars(
							project.vercel.projectId,
							githubBranch,
							vercelToken,
						);
						vercelEnvSpinner.succeed(
							`Removed ${deleted} per-branch Vercel environment variable${deleted !== 1 ? "s" : ""}`,
						);
					} catch {
						vercelEnvSpinner.warn(
							"Could not remove per-branch Vercel env vars. They may need to be removed manually.",
						);
					}
				}
			}

			// Step 2: Delete remote git branch (using GitHub API via gh CLI)
			if (githubBranch) {
				const { execa } = await import("execa");
				const gitSpinner = createSpinner(
					`Deleting remote git branch: ${githubBranch}`,
				).start();
				try {
					// Use gh CLI to delete the branch via API (no local clone needed)
					await execa(
						"gh",
						[
							"api",
							"-X",
							"DELETE",
							`/repos/${project.github.owner}/${project.github.repo}/git/refs/heads/${githubBranch}`,
						],
						{
							env: { ...process.env, GH_TOKEN: githubToken },
						},
					);
					gitSpinner.succeed(`Deleted remote git branch: ${githubBranch}`);
				} catch {
					gitSpinner.warn(
						`Could not delete remote branch. Delete manually: git push origin --delete ${githubBranch}`,
					);
				}
			}

			// Step 3: Delete VM from exe.dev
			const vmSpinner = createSpinner("Deleting VM from exe.dev").start();
			try {
				await exeDevRm(vmName);
				vmSpinner.succeed("VM deleted from exe.dev");
			} catch (error) {
				vmSpinner.fail("Failed to delete VM from exe.dev");
				log.warn(`You may need to delete manually: ssh exe.dev rm ${vmName}`);
			}

			// Step 4: Remove from local tracking
			await removeVM(vmName);

			// Print summary
			log.blank();
			log.success("Feature cleanup complete!");
			log.blank();
			log.info("Deleted resources:");
			log.step(`VM: ${vmName}`);
			if (githubBranch) {
				log.step(`Git branch: ${githubBranch}`);
			}
			if (convexPreviewDeployment) {
				log.step(
					`Convex preview: ${convexPreviewDeployment.deploymentName} (auto-cleanup)`,
				);
			} else if (convexFeatureProject) {
				log.step(`Convex project: ${convexFeatureProject.projectSlug}`);
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
