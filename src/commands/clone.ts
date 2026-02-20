import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import fs from "fs-extra";
import { loadConfigFile } from "../headless/config.js";
import { gitClone, gitCurrentBranch, gitPull } from "../utils/exec.js";
import { log } from "../utils/logger.js";
import { getProject } from "../utils/project-store.js";
import { createSpinner } from "../utils/spinner.js";

interface CloneOptions {
	project: string;
	path?: string;
	pull?: boolean;
	json?: boolean;
}

interface CloneResult {
	path: string;
	action: "cloned" | "pulled";
	branch: string;
}

export async function cloneProject(
	projectName: string,
	options?: { path?: string; pull?: boolean },
): Promise<CloneResult> {
	const project = await getProject(projectName);
	if (!project) {
		throw new Error(
			`Project "${projectName}" not found. Run 'hatch list --projects' to see stored projects.`,
		);
	}

	const cloneUrl = project.github.url;
	const targetDir =
		options?.path || path.join(os.homedir(), "projects", projectName, "repo");

	// Resolve GitHub token for authenticated git operations
	const config = await loadConfigFile();
	const token =
		config?.github?.token ??
		process.env.GITHUB_TOKEN ??
		process.env.GH_TOKEN;

	// --pull mode: only pull, error if not a git repo
	if (options?.pull) {
		if (!(await fs.pathExists(path.join(targetDir, ".git")))) {
			throw new Error(
				`Not a git repo: ${targetDir}. Run 'hatch clone --project ${projectName}' first.`,
			);
		}
		await gitPull(targetDir, token);
		const branch = await gitCurrentBranch(targetDir);
		return { path: targetDir, action: "pulled", branch };
	}

	// Directory exists — check if it's already a git repo
	if (await fs.pathExists(targetDir)) {
		if (await fs.pathExists(path.join(targetDir, ".git"))) {
			await gitPull(targetDir, token);
			const branch = await gitCurrentBranch(targetDir);
			return { path: targetDir, action: "pulled", branch };
		}
		throw new Error(
			`Directory exists but is not a git repo: ${targetDir}. Remove it or use --path to specify a different location.`,
		);
	}

	// Clone fresh
	const parentDir = path.dirname(targetDir);
	await fs.ensureDir(parentDir);
	await gitClone(cloneUrl, targetDir, token);
	const branch = await gitCurrentBranch(targetDir);
	return { path: targetDir, action: "cloned", branch };
}

export const cloneCommand = new Command()
	.name("clone")
	.description("Clone a project's GitHub repo locally for agent context")
	.requiredOption("--project <name>", "Project name")
	.option("--path <dir>", "Custom clone target directory")
	.option("--pull", "Only pull (skip clone logic)")
	.option("--json", "Output result as JSON")
	.action(async (options: CloneOptions) => {
		try {
			const spinner = createSpinner(
				options.pull ? "Pulling latest changes" : "Cloning repository",
			).start();

			const result = await cloneProject(options.project, {
				path: options.path,
				pull: options.pull,
			});

			spinner.succeed(
				result.action === "cloned"
					? `Cloned to ${result.path}`
					: `Pulled latest in ${result.path}`,
			);

			if (options.json) {
				console.log(JSON.stringify(result, null, 2));
			} else {
				log.blank();
				log.success(
					result.action === "cloned"
						? `Repository cloned to ${result.path}`
						: `Repository updated in ${result.path}`,
				);
				log.step(`Branch: ${result.branch}`);
				log.blank();
			}
		} catch (error) {
			log.blank();
			log.error(
				`Failed to clone: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
