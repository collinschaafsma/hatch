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
import type { SupabaseSetupResult } from "./supabase.js";

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
 * Set up Vercel project and configure environment variables
 */
export async function setupVercel(
	projectName: string,
	projectPath: string,
	config: ResolvedHeadlessConfig,
	supabaseResult: SupabaseSetupResult,
	useWorkOS: boolean,
	customEnvVars?: EnvVar[],
): Promise<VercelSetupResult> {
	const token = config.vercel.token;
	const team = config.vercel.team;
	const webPath = `${projectPath}/apps/web`;

	// Link to Vercel from apps/web (where the Next.js app lives)
	// This creates .vercel in apps/web, matching the setup script behavior
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

	// Set root directory to apps/web for git-triggered deployments
	// (CLI deploys from apps/web don't need this, but git pushes do)
	if (projectId && projectId !== "unknown") {
		if (!config.quiet) {
			await withSpinner("Setting Vercel root directory", async () => {
				await setVercelRootDirectory(projectId, "apps/web", token);
			});
		} else {
			await setVercelRootDirectory(projectId, "apps/web", token);
		}
	}

	// Get the git remote URL for connecting
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

	// Connect Git repository by passing the remote URL explicitly
	// This is non-fatal - git might already be connected via GitHub integration
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

	// Set environment variables
	const envVars: Array<{
		key: string;
		value: string;
		environments: ("production" | "preview" | "development")[];
	}> = [
		{
			key: "DATABASE_URL",
			value: supabaseResult.databaseUrl,
			environments: ["production", "preview", "development"],
		},
		{
			key: "NEXT_PUBLIC_SUPABASE_URL",
			value: `https://${supabaseResult.projectRef}.supabase.co`,
			environments: ["production", "preview", "development"],
		},
		{
			key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
			value: supabaseResult.anonKey,
			environments: ["production", "preview", "development"],
		},
		{
			key: "SUPABASE_SERVICE_ROLE_KEY",
			value: supabaseResult.serviceRoleKey,
			environments: ["production", "preview", "development"],
		},
	];

	// Add auth-specific env vars
	if (useWorkOS) {
		// WorkOS env vars will need to be set manually
	} else {
		// Better Auth env vars
		const authSecret = generateAuthSecret();
		envVars.push({
			key: "BETTER_AUTH_SECRET",
			value: authSecret,
			environments: ["production", "preview", "development"],
		});
	}

	// Set env vars (run from apps/web where .vercel lives)
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

	// Pull env vars to .env.local in apps/web (non-fatal like setup script)
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

	// Deployment is triggered by git push in the next step
	// Return a placeholder URL - the real URL will be fetched after deployment
	return {
		url: `https://${projectName}.vercel.app`,
		projectId,
		projectName,
	};
}

/**
 * Set up Vercel project with Convex-specific environment variables
 */
export async function setupVercelForConvex(
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

	// Better Auth secret for Convex
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
