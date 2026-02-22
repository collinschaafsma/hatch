import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import fs from "fs-extra";
import { setVercelPreviewEnvVar } from "../headless/vercel.js";
import { log } from "../utils/logger.js";
import { getProject, updateProject } from "../utils/project-store.js";
import { createSpinner } from "../utils/spinner.js";

interface SetPreviewDeployKeyOptions {
	project: string;
	config?: string;
}

export const setPreviewDeployKeyCommand = new Command()
	.name("set-preview-deploy-key")
	.description(
		"Configure a Convex preview deploy key for a project (enables preview deployments)",
	)
	.argument("<key>", "Convex preview deploy key")
	.requiredOption("--project <name>", "Project name")
	.option(
		"-c, --config <path>",
		"Path to hatch.json config file",
		path.join(os.homedir(), ".hatch.json"),
	)
	.action(async (key: string, options: SetPreviewDeployKeyOptions) => {
		try {
			log.blank();

			// Look up project
			const project = await getProject(options.project);
			if (!project) {
				log.error(`Project not found: ${options.project}`);
				log.info("Run 'hatch list --projects' to see available projects.");
				process.exit(1);
			}

			// Load config to get Vercel token
			const configPath =
				options.config || path.join(os.homedir(), ".hatch.json");
			let vercelToken = "";
			if (await fs.pathExists(configPath)) {
				const config = await fs.readJson(configPath);
				vercelToken = config.vercel?.token || "";
			}

			// Save preview deploy key to project record
			const saveSpinner = createSpinner(
				"Saving preview deploy key to project",
			).start();
			await updateProject(options.project, {
				convex: {
					...(project.convex || {}),
					previewDeployKey: key,
				},
			});
			saveSpinner.succeed("Preview deploy key saved to project record");

			// Set CONVEX_DEPLOY_KEY as Vercel preview env var
			if (vercelToken) {
				const vercelSpinner = createSpinner(
					"Setting CONVEX_DEPLOY_KEY on Vercel (preview environment)",
				).start();
				try {
					await setVercelPreviewEnvVar(
						project.vercel.projectId,
						"CONVEX_DEPLOY_KEY",
						key,
						vercelToken,
					);
					vercelSpinner.succeed(
						"CONVEX_DEPLOY_KEY set on Vercel for preview deployments",
					);
				} catch (error) {
					vercelSpinner.warn(
						`Could not set Vercel env var: ${error instanceof Error ? error.message : error}`,
					);
					log.info(
						"You may need to set CONVEX_DEPLOY_KEY manually in Vercel project settings (preview environment).",
					);
				}
			} else {
				log.warn(
					"No Vercel token found. Set CONVEX_DEPLOY_KEY manually in Vercel project settings (preview environment).",
				);
			}

			log.blank();
			log.success("Preview deploy key configured!");
			log.blank();
			log.info(
				"Vercel preview deployments will now use Convex preview deployments automatically.",
			);
			log.info(
				"Feature VMs (hatch feature/spike) will use preview deployments instead of separate projects.",
			);
			log.blank();
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("User force closed")
			) {
				log.blank();
				log.info("Operation cancelled.");
			} else {
				log.blank();
				log.error(
					`Failed to set preview deploy key: ${error instanceof Error ? error.message : error}`,
				);
			}
			process.exit(1);
		}
	});
