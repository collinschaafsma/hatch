import os from "node:os";
import path from "node:path";
import { input } from "@inquirer/prompts";
import { Command } from "commander";
import fs from "fs-extra";
import { deleteConvexProjectBySlug } from "../headless/convex.js";
import type { HatchConfig } from "../types/index.js";
import { log } from "../utils/logger.js";
import { deleteProject, getProject } from "../utils/project-store.js";
import { createSpinner } from "../utils/spinner.js";
import { listVMsByProject } from "../utils/vm-store.js";

interface DestroyOptions {
	config?: string;
	force?: boolean;
}

interface DestroyResult {
	convexProject: { success: boolean; error?: string };
	vercelProject: { success: boolean; error?: string };
	localStore: { success: boolean; error?: string };
}

export const destroyCommand = new Command()
	.name("destroy")
	.description("Permanently destroy a project and all its resources")
	.argument("<project-name>", "Project to destroy")
	.option(
		"-c, --config <path>",
		"Path to hatch.json config file",
		path.join(os.homedir(), ".hatch.json"),
	)
	.option("-f, --force", "Skip confirmation (dangerous)")
	.action(async (projectName: string, options: DestroyOptions) => {
		try {
			log.blank();

			// Phase 1: Pre-flight - Look up project
			const project = await getProject(projectName);
			if (!project) {
				log.error(`Project not found: ${projectName}`);
				log.info("Run 'hatch list --projects' to see available projects.");
				process.exit(1);
			}

			// Load config to get tokens
			const configPath =
				options.config || path.join(os.homedir(), ".hatch.json");
			let config: HatchConfig = { convex: {} };
			if (await fs.pathExists(configPath)) {
				config = await fs.readJson(configPath);
			}

			const convexAccessToken = config.convex?.accessToken || "";
			const vercelTeam = config.vercel?.team || "";

			// Check for feature VMs - must be cleaned first
			const featureVMs = await listVMsByProject(projectName);
			if (featureVMs.length > 0) {
				log.error(
					`Project has ${featureVMs.length} active feature VM(s). Clean them first:`,
				);
				log.blank();
				for (const vm of featureVMs) {
					log.step(`hatch clean ${vm.feature} --project ${projectName}`);
				}
				log.blank();
				process.exit(1);
			}

			// Phase 2: Display Destruction Plan
			log.warn("This will PERMANENTLY destroy the following resources:");
			log.blank();
			log.info(`Project: ${projectName}`);
			log.blank();

			log.step("Convex:");
			log.info(`    → Project: ${project.convex.projectSlug}`);
			if (project.convex.deploymentUrl) {
				log.info(`    → Deployment: ${project.convex.deploymentUrl}`);
			}
			log.blank();

			log.step("Vercel:");
			log.info(`    → Project: ${projectName} (${project.vercel.projectId})`);
			log.blank();

			log.step("Local:");
			log.info("    → Project record in ~/.hatch/projects.json");
			log.blank();

			log.step("GitHub (preserved - manual deletion required):");
			log.info(`    → Repository: ${project.github.url}`);
			log.blank();

			// Phase 3: Type-to-Confirm
			if (!options.force) {
				const confirmation = await input({
					message: `Type "${projectName}" to confirm destruction:`,
				});

				if (confirmation !== projectName) {
					log.error("Project name does not match. Aborting.");
					process.exit(1);
				}
			}

			log.blank();

			// Track results for summary
			const results: DestroyResult = {
				convexProject: { success: false },
				vercelProject: { success: false },
				localStore: { success: false },
			};

			// Phase 4: Delete Convex project
			const convexSpinner = createSpinner("Deleting Convex project").start();
			try {
				const slug = project.convex.projectSlug;
				if (!slug) {
					throw new Error("No Convex project slug found in project record");
				}
				if (!convexAccessToken) {
					throw new Error(
						"No Convex access token found in config (~/.hatch.json)",
					);
				}
				await deleteConvexProjectBySlug(slug, convexAccessToken);
				results.convexProject = { success: true };
				convexSpinner.succeed("Deleted Convex project");
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				results.convexProject = { success: false, error: errorMsg };
				convexSpinner.fail("Failed to delete Convex project");
			}

			// Phase 5: Delete Vercel Project
			const { execa } = await import("execa");
			const vercelSpinner = createSpinner("Deleting Vercel project").start();
			try {
				const vercelArgs = ["project", "rm", project.vercel.projectId];
				if (vercelTeam) {
					vercelArgs.push("--scope", vercelTeam);
				}
				await execa("vercel", vercelArgs, {
					stdio: "pipe",
					input: "y\n",
				});
				results.vercelProject = { success: true };
				vercelSpinner.succeed("Deleted Vercel project");
			} catch (error) {
				results.vercelProject = {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
				vercelSpinner.fail("Failed to delete Vercel project");
			}

			// Phase 6: Remove from Local Store
			const localSpinner = createSpinner(
				"Removing from local tracking",
			).start();
			try {
				await deleteProject(projectName);
				results.localStore = { success: true };
				localSpinner.succeed("Removed from local tracking");
			} catch (error) {
				results.localStore = {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
				localSpinner.fail("Failed to remove from local tracking");
			}

			// Phase 7: Summary
			log.blank();

			const allSuccess =
				results.convexProject.success &&
				results.vercelProject.success &&
				results.localStore.success;

			if (allSuccess) {
				log.success(`Project "${projectName}" destroyed.`);
			} else {
				log.warn(
					`Project "${projectName}" partially destroyed. Manual cleanup needed:`,
				);
				log.blank();

				if (!results.convexProject.success) {
					log.error("Convex project:");
					log.info(`    ${results.convexProject.error}`);
					log.info(
						`    Manual: Delete via https://dashboard.convex.dev (project: ${project.convex.projectSlug})`,
					);
				}

				if (!results.vercelProject.success) {
					log.error("Vercel project:");
					const scopeArg = vercelTeam ? ` --scope ${vercelTeam}` : "";
					log.info(
						`    vercel project rm ${project.vercel.projectId}${scopeArg}`,
					);
				}

				if (!results.localStore.success) {
					log.error("Local tracking:");
					log.info(
						"    Manually edit ~/.hatch/projects.json to remove the project",
					);
				}
			}

			// Always show GitHub reminder
			log.blank();
			log.info("GitHub repository preserved (delete manually if needed):");
			log.step(
				`gh repo delete ${project.github.owner}/${project.github.repo} --yes`,
			);
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
				`Failed to destroy project: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
