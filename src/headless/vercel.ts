import crypto from "node:crypto";
import type { EnvVar, ResolvedHeadlessConfig } from "../types/index.js";
import { log } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import {
	vercelEnvAdd,
	vercelEnvPull,
	vercelGitConnect,
	vercelLink,
} from "./cli-wrappers.js";
import type { ConvexSetupResult } from "./convex.js";

export interface VercelSetupResult {
	url: string;
	projectId: string;
	projectName: string;
}

/**
 * Generate a secure secret for auth
 */
function generateAuthSecret(): string {
	return crypto.randomBytes(32).toString("base64");
}

/**
 * Set Vercel project root directory via API
 * Required for monorepos where the app is in a subdirectory
 */
async function setVercelRootDirectory(
	projectId: string,
	rootDirectory: string,
	token: string,
): Promise<void> {
	const response = await fetch(
		`https://api.vercel.com/v9/projects/${projectId}`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ rootDirectory }),
		},
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to set Vercel root directory: ${error}`);
	}
}

/**
 * Set per-branch scoped environment variables on a Vercel project.
 * Uses upsert to make it idempotent (safe to re-run).
 */
export async function setVercelBranchEnvVars(
	projectId: string,
	gitBranch: string,
	envVars: Array<{ key: string; value: string }>,
	token: string,
): Promise<void> {
	const response = await fetch(
		`https://api.vercel.com/v10/projects/${projectId}/env?upsert=true`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(
				envVars.map((v) => ({
					key: v.key,
					value: v.value,
					type: "plain",
					target: ["preview"],
					gitBranch,
				})),
			),
		},
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to set per-branch Vercel env vars: ${error}`);
	}
}

/**
 * Set a project-wide environment variable scoped to the "preview" target (not branch-scoped).
 * Uses upsert to make it idempotent.
 */
export async function setVercelPreviewEnvVar(
	projectId: string,
	key: string,
	value: string,
	token: string,
): Promise<void> {
	const response = await fetch(
		`https://api.vercel.com/v10/projects/${projectId}/env?upsert=true`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify([
				{
					key,
					value,
					type: "encrypted",
					target: ["preview"],
				},
			]),
		},
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to set Vercel preview env var: ${error}`);
	}
}

/**
 * List env vars scoped to a specific git branch on a Vercel project.
 */
async function listVercelBranchEnvVars(
	projectId: string,
	gitBranch: string,
	token: string,
): Promise<Array<{ id: string; key: string }>> {
	const response = await fetch(
		`https://api.vercel.com/v9/projects/${projectId}/env?gitBranch=${encodeURIComponent(gitBranch)}`,
		{
			headers: {
				Authorization: `Bearer ${token}`,
			},
		},
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to list Vercel env vars: ${error}`);
	}

	const data = (await response.json()) as {
		envs: Array<{ id: string; key: string; gitBranch?: string }>;
	};
	return data.envs
		.filter((e) => e.gitBranch === gitBranch)
		.map((e) => ({ id: e.id, key: e.key }));
}

/**
 * Delete all env vars scoped to a specific git branch on a Vercel project.
 * Best-effort: logs failures but doesn't throw.
 */
export async function deleteVercelBranchEnvVars(
	projectId: string,
	gitBranch: string,
	token: string,
): Promise<number> {
	const envVars = await listVercelBranchEnvVars(projectId, gitBranch, token);
	let deleted = 0;

	for (const env of envVars) {
		try {
			const response = await fetch(
				`https://api.vercel.com/v9/projects/${projectId}/env/${env.id}`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${token}`,
					},
				},
			);
			if (response.ok) {
				deleted++;
			}
		} catch {
			// Best-effort: continue with other vars
		}
	}

	return deleted;
}

/**
 * Set up Vercel project with Convex-specific environment variables
 */
export async function setupVercel(
	projectName: string,
	projectPath: string,
	config: ResolvedHeadlessConfig,
	convexResult: ConvexSetupResult,
	customEnvVars?: EnvVar[],
): Promise<VercelSetupResult> {
	const token = config.vercel.token;
	const team = config.vercel.team;
	const webPath = `${projectPath}/apps/web`;

	// Link to Vercel
	let projectId: string;

	if (!config.quiet) {
		const linkResult = await withSpinner(
			`Linking Vercel project ${projectName}`,
			async () => {
				return vercelLink({
					projectName,
					team,
					cwd: webPath,
					token,
				});
			},
		);
		projectId = linkResult.projectId;
	} else {
		const linkResult = await vercelLink({
			projectName,
			team,
			cwd: webPath,
			token,
		});
		projectId = linkResult.projectId;
	}

	// Set root directory
	if (projectId && projectId !== "unknown") {
		if (!config.quiet) {
			await withSpinner("Setting Vercel root directory", async () => {
				await setVercelRootDirectory(projectId, "apps/web", token);
			});
		} else {
			await setVercelRootDirectory(projectId, "apps/web", token);
		}
	}

	// Connect Git repository
	const { execa } = await import("execa");
	let gitUrl: string | undefined;
	try {
		const gitResult = await execa("git", ["remote", "get-url", "origin"], {
			cwd: projectPath,
		});
		gitUrl = gitResult.stdout.trim();
	} catch {
		// Git remote might not exist yet
	}

	if (gitUrl) {
		try {
			if (!config.quiet) {
				await withSpinner("Connecting Git to Vercel", async () => {
					await vercelGitConnect({ cwd: webPath, token, gitUrl });
				});
			} else {
				await vercelGitConnect({ cwd: webPath, token, gitUrl });
			}
		} catch {
			if (!config.quiet) {
				log.warn(
					"Could not auto-connect Git - may already be connected or connect manually in Vercel dashboard",
				);
			}
		}
	}

	// Set Convex-specific environment variables
	// deploymentUrl = https://{name}.convex.cloud (client queries)
	// siteUrl = https://{name}.convex.site (HTTP actions, auth routes)
	const siteUrl = convexResult.deploymentUrl.replace(
		".convex.cloud",
		".convex.site",
	);
	const envVars: Array<{
		key: string;
		value: string;
		environments: ("production" | "preview" | "development")[];
	}> = [
		{
			key: "NEXT_PUBLIC_CONVEX_URL",
			value: convexResult.deploymentUrl,
			environments: ["production", "preview", "development"],
		},
		{
			key: "NEXT_PUBLIC_CONVEX_SITE_URL",
			value: siteUrl,
			environments: ["production", "preview", "development"],
		},
	];

	// Add deploy key for build-time access
	if (convexResult.deployKey) {
		envVars.push({
			key: "CONVEX_DEPLOY_KEY",
			value: convexResult.deployKey,
			environments: ["production", "preview", "development"],
		});
	}

	// Better Auth secret
	const authSecret = generateAuthSecret();
	envVars.push({
		key: "BETTER_AUTH_SECRET",
		value: authSecret,
		environments: ["production", "preview", "development"],
	});

	// Set env vars
	if (!config.quiet) {
		await withSpinner("Setting Vercel environment variables", async () => {
			for (const env of envVars) {
				await vercelEnvAdd({
					key: env.key,
					value: env.value,
					environments: env.environments,
					cwd: webPath,
					token,
				});
			}
		});
	} else {
		for (const env of envVars) {
			await vercelEnvAdd({
				key: env.key,
				value: env.value,
				environments: env.environments,
				cwd: webPath,
				token,
			});
		}
	}

	// Set custom env vars from hatch.json
	if (customEnvVars?.length) {
		if (!config.quiet) {
			await withSpinner("Setting custom environment variables", async () => {
				for (const env of customEnvVars) {
					await vercelEnvAdd({
						key: env.key,
						value: env.value,
						environments: env.environments,
						cwd: webPath,
						token,
					});
				}
			});
		} else {
			for (const env of customEnvVars) {
				await vercelEnvAdd({
					key: env.key,
					value: env.value,
					environments: env.environments,
					cwd: webPath,
					token,
				});
			}
		}
	}

	// Pull env vars to .env.local
	try {
		if (!config.quiet) {
			await withSpinner(
				"Pulling Vercel environment to .env.local",
				async () => {
					await vercelEnvPull({ cwd: webPath, token });
				},
			);
		} else {
			await vercelEnvPull({ cwd: webPath, token });
		}
	} catch {
		if (!config.quiet) {
			log.warn(
				"Could not pull env vars - they may need to be configured manually",
			);
		}
	}

	return {
		url: `https://${projectName}.vercel.app`,
		projectId,
		projectName,
	};
}
