import type { ResolvedHeadlessConfig } from "../types/index.js";
import { log } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import { getGhUsername, ghRepoCreate, ghRepoExists } from "./cli-wrappers.js";
import { resolveNameConflict } from "./conflicts.js";

export interface GitHubSetupResult {
	url: string;
	owner: string;
	repo: string;
	wasRenamed: boolean;
	originalName: string;
}

/**
 * Set up GitHub repository with conflict resolution
 */
export async function setupGitHub(
	projectName: string,
	projectPath: string,
	config: ResolvedHeadlessConfig,
): Promise<GitHubSetupResult> {
	const token = config.github.token;
	let owner: string;

	// Determine the owner (org or user)
	if (config.github.org) {
		owner = config.github.org;
	} else {
		owner = await getGhUsername(token);
	}

	let repoName = projectName;
	let wasRenamed = false;
	const originalName = projectName;

	// Check if repo exists and handle conflict
	const exists = await ghRepoExists(owner, repoName, token);
	if (exists) {
		if (!config.quiet) {
			log.warn(`Repository ${owner}/${repoName} already exists`);
		}
		repoName = resolveNameConflict(repoName, config.conflictStrategy);
		wasRenamed = true;
		if (!config.quiet) {
			log.info(`Using ${repoName} instead`);
		}
	}

	// Create the repository
	let result: { url: string; owner: string; repo: string };

	if (!config.quiet) {
		result = await withSpinner(
			`Creating GitHub repository ${owner}/${repoName}`,
			async () => {
				return ghRepoCreate(repoName, {
					org: config.github.org,
					private: true,
					cwd: projectPath,
					token,
				});
			},
		);
	} else {
		result = await ghRepoCreate(repoName, {
			org: config.github.org,
			private: true,
			cwd: projectPath,
			token,
		});
	}

	return {
		url: result.url,
		owner: result.owner,
		repo: result.repo,
		wasRenamed,
		originalName,
	};
}
