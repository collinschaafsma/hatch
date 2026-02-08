import os from "node:os";
import path from "node:path";
import { confirm } from "@inquirer/prompts";
import { Command } from "commander";
import { execa } from "execa";
import fs from "fs-extra";
import { deleteConvexProject } from "../headless/convex.js";
import { deleteVercelBranchEnvVars } from "../headless/vercel.js";
import { exeDevRm } from "../utils/exe-dev.js";
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
	.description("Clean up a feature VM and its backend branches")
	.argument("<feature-name>", "Feature name to clean up")
	.requiredOption("--project <name>", "Project name")
	.option("-f, --force", "Skip confirmation prompt")
	.option(
		"-c, --config <path>",
		"Path to hatch.json config file",
		path.join(os.homedir(), ".hatch.json"),
	)
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

			// Load config to get tokens
			const configPath =
				options.config || path.join(os.homedir(), ".hatch.json");
			let supabaseToken = "";
			let githubToken = "";
			let convexAccessToken = "";
			let vercelToken = "";
			if (await fs.pathExists(configPath)) {
				const config = await fs.readJson(configPath);
				supabaseToken = config.supabase?.token || "";
				githubToken = config.github?.token || "";
				convexAccessToken = config.convex?.accessToken || "";
				vercelToken = config.vercel?.token || "";
			}

			const {
				name: vmName,
				supabaseBranches,
				githubBranch,
				convexFeatureProject,
				convexPreviewName,
			} = vmRecord;
			const useConvex =
				vmRecord.backendProvider === "convex" ||
				!!convexFeatureProject ||
				!!convexPreviewName;

			// Show what will be deleted
			log.info(`Feature: ${featureName}`);
			log.step(`Project: ${options.project}`);
			log.step(`VM: ${vmName}`);
			if (githubBranch) {
				log.step(`Git branch: ${githubBranch}`);
			}
			if (useConvex && convexFeatureProject) {
				log.step(`Convex project: ${convexFeatureProject.projectSlug}`);
			} else if (useConvex && convexPreviewName) {
				log.step(`Convex preview (legacy): ${convexPreviewName}`);
			} else if (supabaseBranches.length > 0) {
				log.step(`Supabase branches: ${supabaseBranches.join(", ")}`);
			}
			log.blank();

			// Confirm deletion
			if (!options.force) {
				const confirmed = await confirm({
					message: useConvex
						? "Are you sure you want to delete this feature VM and its Convex project?"
						: "Are you sure you want to delete this feature VM and its Supabase branches?",
					default: false,
				});

				if (!confirmed) {
					log.info("Operation cancelled.");
					process.exit(0);
				}
			}

			log.blank();

			// Step 1: Delete backend branches/projects
			if (useConvex && convexFeatureProject) {
				// Delete Convex feature project via API
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
				// Clean up per-branch Vercel env vars for Convex features
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
			} else if (useConvex && convexPreviewName) {
				// Legacy: old preview-based VMRecord
				log.warn(
					`VM has legacy Convex preview "${convexPreviewName}". Delete it manually from the Convex dashboard.`,
				);
			} else if (supabaseBranches.length > 0) {
				// Delete Supabase branches
				const supabaseSpinner = createSpinner(
					"Deleting Supabase branches",
				).start();

				const deletedBranches: string[] = [];
				const failedBranches: string[] = [];

				for (const branch of supabaseBranches) {
					try {
						await execa(
							"supabase",
							[
								"branches",
								"update",
								branch,
								"--persistent=false",
								"--project-ref",
								project.supabase?.projectRef,
							],
							{
								env: { ...process.env, SUPABASE_ACCESS_TOKEN: supabaseToken },
							},
						);
						await new Promise((resolve) => setTimeout(resolve, 2000));
						await execa(
							"supabase",
							[
								"branches",
								"delete",
								branch,
								"--project-ref",
								project.supabase?.projectRef,
							],
							{
								env: { ...process.env, SUPABASE_ACCESS_TOKEN: supabaseToken },
							},
						);
						deletedBranches.push(branch);
					} catch (error) {
						console.error(`Failed to delete branch ${branch}:`, error);
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

			// Step 2: Delete remote git branch (using GitHub API via gh CLI)
			if (githubBranch) {
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

			// Step 4: Delete VM from exe.dev
			const vmSpinner = createSpinner("Deleting VM from exe.dev").start();
			try {
				await exeDevRm(vmName);
				vmSpinner.succeed("VM deleted from exe.dev");
			} catch (error) {
				vmSpinner.fail("Failed to delete VM from exe.dev");
				log.warn(`You may need to delete manually: ssh exe.dev rm ${vmName}`);
			}

			// Step 5: Remove from local tracking
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
			if (useConvex && convexFeatureProject) {
				log.step(`Convex project: ${convexFeatureProject.projectSlug}`);
			} else if (useConvex && convexPreviewName) {
				log.step(`Convex preview (legacy): ${convexPreviewName}`);
			} else if (supabaseBranches.length > 0) {
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
