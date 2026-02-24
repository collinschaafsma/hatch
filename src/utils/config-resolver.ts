import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

const CONFIGS_DIR = path.join(os.homedir(), ".hatch", "configs");

/**
 * Resolve config file path using the following priority:
 * 1. --config <path> (explicit path)
 * 2. --project <name> → ~/.hatch/configs/<name>.json
 * 3. ./hatch.json (current directory)
 * 4. ~/.hatch.json (global fallback)
 *
 * Returns the first path that exists, or the global fallback path if nothing exists.
 */
export async function resolveConfigPath(options: {
	configPath?: string;
	project?: string;
}): Promise<string> {
	// 1. Explicit --config path
	if (options.configPath) {
		return options.configPath.startsWith("~")
			? path.join(os.homedir(), options.configPath.slice(1))
			: path.resolve(options.configPath);
	}

	// 2. Per-project config
	if (options.project) {
		const projectConfigPath = path.join(CONFIGS_DIR, `${options.project}.json`);
		if (await fs.pathExists(projectConfigPath)) {
			return projectConfigPath;
		}
	}

	// 3. Current directory hatch.json
	const cwdConfig = path.join(process.cwd(), "hatch.json");
	if (await fs.pathExists(cwdConfig)) {
		return cwdConfig;
	}

	// 4. Global fallback
	return path.join(os.homedir(), ".hatch.json");
}

/**
 * Get the path where a per-project config should be written.
 * Ensures the configs directory exists.
 */
export async function getProjectConfigPath(
	projectName: string,
): Promise<string> {
	await fs.ensureDir(CONFIGS_DIR);
	return path.join(CONFIGS_DIR, `${projectName}.json`);
}

export interface ProjectConfigInfo {
	name: string;
	path: string;
	hasGithub: boolean;
	hasVercel: boolean;
	hasConvex: boolean;
	hasAnthropic: boolean;
}

/**
 * List all per-project configs in ~/.hatch/configs/
 */
export async function listProjectConfigs(): Promise<ProjectConfigInfo[]> {
	if (!(await fs.pathExists(CONFIGS_DIR))) {
		return [];
	}

	const files = await fs.readdir(CONFIGS_DIR);
	const configs: ProjectConfigInfo[] = [];

	for (const file of files) {
		if (!file.endsWith(".json")) continue;

		const filePath = path.join(CONFIGS_DIR, file);
		try {
			const config = await fs.readJson(filePath);
			configs.push({
				name: file.replace(/\.json$/, ""),
				path: filePath,
				hasGithub: !!config.github?.token,
				hasVercel: !!config.vercel?.token,
				hasConvex: !!config.convex?.accessToken,
				hasAnthropic: !!config.anthropicApiKey,
			});
		} catch {
			// Skip invalid JSON files
		}
	}

	return configs;
}
