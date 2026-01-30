import crypto from "node:crypto";
import type { ResolvedHeadlessConfig } from "../types/index.js";
import { log } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import {
	vercelDeploy,
	vercelEnvAdd,
	vercelEnvPull,
	vercelGitConnect,
	vercelLink,
} from "./cli-wrappers.js";
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
 * Set up Vercel project and configure environment variables
 */
export async function setupVercel(
	projectName: string,
	projectPath: string,
	config: ResolvedHeadlessConfig,
	supabaseResult: SupabaseSetupResult,
	useWorkOS: boolean,
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

	// Connect Git repository
	if (!config.quiet) {
		await withSpinner("Connecting Git to Vercel", async () => {
			await vercelGitConnect({ cwd: webPath, token });
		});
	} else {
		await vercelGitConnect({ cwd: webPath, token });
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

	// Pull env vars to .env.local
	if (!config.quiet) {
		await withSpinner("Pulling Vercel environment to .env.local", async () => {
			await vercelEnvPull({ cwd: webPath, token });
		});
	} else {
		await vercelEnvPull({ cwd: webPath, token });
	}

	// Deploy to production
	let deployUrl: string;

	if (!config.quiet) {
		const deployResult = await withSpinner("Deploying to Vercel", async () => {
			return vercelDeploy({ cwd: webPath, token, prod: true });
		});
		deployUrl = deployResult.url;
	} else {
		const deployResult = await vercelDeploy({
			cwd: webPath,
			token,
			prod: true,
		});
		deployUrl = deployResult.url;
	}

	return {
		url: deployUrl,
		projectId,
		projectName,
	};
}
