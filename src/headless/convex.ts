import crypto from "node:crypto";
import { execa } from "execa";
import type { EnvVar, ResolvedHeadlessConfig } from "../types/index.js";
import { log } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";

const CONVEX_API_BASE = "https://api.convex.dev/v1";

export interface ConvexSetupResult {
	deploymentUrl: string;
	projectSlug: string;
	deployKey: string;
	deploymentName: string;
}

// --- Convex Management API helpers ---

/**
 * Get team ID from a Convex access token
 */
export async function getConvexTokenDetails(
	accessToken: string,
): Promise<{ teamId: string }> {
	const response = await fetch(`${CONVEX_API_BASE}/token_details`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`Convex token validation failed (${response.status}): ${text}`,
		);
	}

	const data = (await response.json()) as { teamId: number | string };
	return { teamId: String(data.teamId) };
}

/**
 * List existing projects in a Convex team
 */
async function listConvexProjects(
	teamId: string,
	accessToken: string,
): Promise<Array<{ id: string; name: string }>> {
	const response = await fetch(
		`${CONVEX_API_BASE}/teams/${teamId}/list_projects`,
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`Failed to list Convex projects (${response.status}): ${text}`,
		);
	}

	return (await response.json()) as Array<{ id: string; name: string }>;
}

/**
 * Create a new Convex project
 */
async function createConvexProject(
	name: string,
	teamId: string,
	accessToken: string,
): Promise<{
	projectId: string;
	deploymentName: string;
	deploymentUrl: string;
}> {
	const response = await fetch(
		`${CONVEX_API_BASE}/teams/${teamId}/create_project`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ projectName: name, deploymentType: "prod" }),
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`Failed to create Convex project (${response.status}): ${text}`,
		);
	}

	const data = (await response.json()) as {
		projectId: string;
		deploymentName: string;
		deploymentUrl: string;
	};
	return data;
}

/**
 * Create a deploy key for a Convex deployment
 */
async function createConvexDeployKey(
	deploymentName: string,
	accessToken: string,
): Promise<string> {
	const response = await fetch(
		`${CONVEX_API_BASE}/deployments/${deploymentName}/create_deploy_key`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: "hatch-deploy-key" }),
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`Failed to create Convex deploy key (${response.status}): ${text}`,
		);
	}

	const data = (await response.json()) as { deployKey: string };
	return data.deployKey;
}

/**
 * Set an environment variable on a Convex deployment via CLI
 */
async function setConvexEnvVar(
	key: string,
	value: string,
	deployKey: string,
	webPath: string,
): Promise<void> {
	await execa("npx", ["convex", "env", "set", key, value], {
		cwd: webPath,
		env: { ...process.env, CONVEX_DEPLOY_KEY: deployKey },
	});
}

/**
 * Check if a Convex project with the given name already exists
 */
export async function convexProjectExists(
	projectName: string,
	teamId: string,
	accessToken: string,
): Promise<boolean> {
	const projects = await listConvexProjects(teamId, accessToken);
	return projects.some(
		(p) => p.name.toLowerCase() === projectName.toLowerCase(),
	);
}

// --- Setup functions ---

/**
 * Set up Convex project - create via API, deploy schema, set env vars
 */
export async function setupConvex(
	projectName: string,
	projectPath: string,
	config: ResolvedHeadlessConfig,
	quiet: boolean,
	customEnvVars?: EnvVar[],
): Promise<ConvexSetupResult> {
	if (!config.convex) {
		throw new Error("Convex config is required");
	}

	const accessToken = config.convex.accessToken;
	const webPath = `${projectPath}/apps/web`;

	// Step 1: Auto-detect team ID
	let teamId: string;
	if (!quiet) {
		teamId = await withSpinner(
			"Detecting Convex team from access token",
			async () => {
				const details = await getConvexTokenDetails(accessToken);
				return details.teamId;
			},
		);
	} else {
		const details = await getConvexTokenDetails(accessToken);
		teamId = details.teamId;
	}

	// Step 2: Check name conflicts
	let resolvedName = projectName;
	const exists = await convexProjectExists(resolvedName, teamId, accessToken);
	if (exists) {
		if (config.conflictStrategy === "fail") {
			throw new Error(
				`Convex project "${resolvedName}" already exists. Use --conflict-strategy suffix to auto-rename.`,
			);
		}
		// Append suffix for uniqueness
		const suffix = crypto.randomBytes(3).toString("hex");
		resolvedName = `${resolvedName}-${suffix}`;
		if (!quiet) {
			log.warn(`Convex project name conflict. Using: ${resolvedName}`);
		}
	}

	// Step 3: Create project via API
	let deploymentName: string;
	let deploymentUrl: string;

	if (!quiet) {
		const result = await withSpinner(
			`Creating Convex project: ${resolvedName}`,
			async () => {
				return createConvexProject(resolvedName, teamId, accessToken);
			},
		);
		deploymentName = result.deploymentName;
		deploymentUrl = result.deploymentUrl;
	} else {
		const result = await createConvexProject(resolvedName, teamId, accessToken);
		deploymentName = result.deploymentName;
		deploymentUrl = result.deploymentUrl;
	}

	// Step 4: Generate deploy key
	let deployKey: string;
	if (!quiet) {
		deployKey = await withSpinner("Generating Convex deploy key", async () => {
			return createConvexDeployKey(deploymentName, accessToken);
		});
	} else {
		deployKey = await createConvexDeployKey(deploymentName, accessToken);
	}

	const env = { ...process.env, CONVEX_DEPLOY_KEY: deployKey };

	// Step 5: Deploy schema and functions
	if (!quiet) {
		await withSpinner("Deploying Convex schema and functions", async () => {
			await execa("npx", ["convex", "deploy", "--yes"], {
				cwd: webPath,
				env,
			});
		});
	} else {
		await execa("npx", ["convex", "deploy", "--yes"], {
			cwd: webPath,
			env,
		});
	}

	// Step 6: Set env vars on the deployment
	if (!quiet) {
		await withSpinner("Setting Convex environment variables", async () => {
			const authSecret = crypto.randomBytes(32).toString("base64");
			await setConvexEnvVar(
				"BETTER_AUTH_SECRET",
				authSecret,
				deployKey,
				webPath,
			);
			await setConvexEnvVar(
				"SITE_URL",
				`https://${resolvedName}.vercel.app`,
				deployKey,
				webPath,
			);
		});
	} else {
		const authSecret = crypto.randomBytes(32).toString("base64");
		await setConvexEnvVar("BETTER_AUTH_SECRET", authSecret, deployKey, webPath);
		await setConvexEnvVar(
			"SITE_URL",
			`https://${resolvedName}.vercel.app`,
			deployKey,
			webPath,
		);
	}

	// Step 7: Push custom env vars (e.g. RESEND_API_KEY, EMAIL_FROM)
	if (customEnvVars?.length) {
		if (!quiet) {
			await withSpinner(
				"Setting custom Convex environment variables",
				async () => {
					for (const envVar of customEnvVars) {
						await setConvexEnvVar(envVar.key, envVar.value, deployKey, webPath);
					}
				},
			);
		} else {
			for (const envVar of customEnvVars) {
				await setConvexEnvVar(envVar.key, envVar.value, deployKey, webPath);
			}
		}
	}

	return {
		deploymentUrl,
		projectSlug: resolvedName,
		deployKey,
		deploymentName,
	};
}

/**
 * Set environment variables on a Convex deployment via the Deployment Admin API.
 * Uses HTTP API directly (no CLI needed).
 */
export async function setConvexEnvVarViaAPI(
	deploymentName: string,
	accessToken: string,
	envVars: Array<{ name: string; value: string }>,
): Promise<void> {
	const response = await fetch(
		`https://${deploymentName}.convex.cloud/api/v1/update_environment_variables`,
		{
			method: "POST",
			headers: {
				Authorization: `Convex ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				changes: envVars.map(({ name, value }) => ({ name, value })),
			}),
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`Failed to set Convex env vars (${response.status}): ${text}`,
		);
	}
}

/**
 * Look up a Convex project by slug name and delete it.
 * Resolves the projectId internally via the team's project list.
 */
export async function deleteConvexProjectBySlug(
	slug: string,
	accessToken: string,
): Promise<void> {
	const { teamId } = await getConvexTokenDetails(accessToken);
	const projects = await listConvexProjects(teamId, accessToken);
	const project = projects.find(
		(p) => p.name.toLowerCase() === slug.toLowerCase(),
	);
	if (!project) {
		throw new Error(
			`Convex project "${slug}" not found in team. It may have already been deleted.`,
		);
	}
	await deleteConvexProject(project.id, accessToken);
}

/**
 * Delete a Convex project via the Management API
 */
export async function deleteConvexProject(
	projectId: string,
	accessToken: string,
): Promise<void> {
	const response = await fetch(
		`${CONVEX_API_BASE}/projects/${projectId}/delete`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`Failed to delete Convex project (${response.status}): ${text}`,
		);
	}
}

/**
 * Create a separate Convex project for a feature branch.
 * Orchestrates: get teamId → create project → create deploy key → set env vars.
 * Returns all info needed to deploy code and track the project.
 */
export async function createConvexFeatureProject(
	projectSlug: string,
	featureName: string,
	accessToken: string,
	appUrl: string,
	quiet: boolean,
	customEnvVars?: EnvVar[],
): Promise<{
	projectId: string;
	projectSlug: string;
	deploymentName: string;
	deploymentUrl: string;
	deployKey: string;
}> {
	// Step 1: Get team ID
	let teamId: string;
	if (!quiet) {
		teamId = await withSpinner(
			"Detecting Convex team from access token",
			async () => {
				const details = await getConvexTokenDetails(accessToken);
				return details.teamId;
			},
		);
	} else {
		const details = await getConvexTokenDetails(accessToken);
		teamId = details.teamId;
	}

	// Step 2: Create project (name: "{slug}-{feature}")
	const projectName = `${projectSlug}-${featureName}`;
	let projectId: string;
	let deploymentName: string;
	let deploymentUrl: string;

	if (!quiet) {
		const result = await withSpinner(
			`Creating Convex feature project: ${projectName}`,
			async () => {
				return createConvexProject(projectName, teamId, accessToken);
			},
		);
		projectId = result.projectId;
		deploymentName = result.deploymentName;
		deploymentUrl = result.deploymentUrl;
	} else {
		const result = await createConvexProject(projectName, teamId, accessToken);
		projectId = result.projectId;
		deploymentName = result.deploymentName;
		deploymentUrl = result.deploymentUrl;
	}

	// Step 3: Create deploy key
	let deployKey: string;
	if (!quiet) {
		deployKey = await withSpinner("Generating Convex deploy key", async () => {
			return createConvexDeployKey(deploymentName, accessToken);
		});
	} else {
		deployKey = await createConvexDeployKey(deploymentName, accessToken);
	}

	// Step 4: Set env vars via Deployment Admin API
	const authSecret = crypto.randomBytes(32).toString("hex");
	const envVarsToSet = [
		{ name: "BETTER_AUTH_SECRET", value: authSecret },
		{ name: "SITE_URL", value: appUrl },
		{ name: "BETTER_AUTH_URL", value: appUrl },
		...(customEnvVars?.map((v) => ({ name: v.key, value: v.value })) ?? []),
	];
	if (!quiet) {
		await withSpinner("Setting Convex environment variables", async () => {
			await setConvexEnvVarViaAPI(deploymentName, accessToken, envVarsToSet);
		});
	} else {
		await setConvexEnvVarViaAPI(deploymentName, accessToken, envVarsToSet);
	}

	return {
		projectId,
		projectSlug: projectName,
		deploymentName,
		deploymentUrl,
		deployKey,
	};
}
