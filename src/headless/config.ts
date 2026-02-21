import fs from "fs-extra";
import type {
	HatchConfig,
	HeadlessOptions,
	ResolvedHeadlessConfig,
} from "../types/index.js";
import { resolveConfigPath } from "../utils/config-resolver.js";

/**
 * Load hatch.json config file using the standard resolution order:
 * 1. Explicit configPath (--config)
 * 2. Per-project config (--project → ~/.hatch/configs/<name>.json)
 * 3. ./hatch.json (current directory)
 * 4. ~/.hatch.json (global fallback)
 */
export async function loadConfigFile(options?: {
	configPath?: string;
	project?: string;
}): Promise<HatchConfig | null> {
	const resolvedPath = await resolveConfigPath({
		configPath: options?.configPath,
		project: options?.project,
	});

	if (await fs.pathExists(resolvedPath)) {
		try {
			const content = await fs.readFile(resolvedPath, "utf-8");
			return JSON.parse(content) as HatchConfig;
		} catch {
			throw new Error(`Failed to parse config file: ${resolvedPath}`);
		}
	}

	return null;
}

/**
 * Resolve configuration from CLI flags, config file, and environment variables.
 * Priority: CLI flags > config file > environment variables
 */
export async function resolveConfig(
	options: HeadlessOptions,
): Promise<ResolvedHeadlessConfig> {
	const config = await loadConfigFile({ configPath: options.configPath });

	// GitHub token resolution
	const githubToken =
		options.githubToken ??
		config?.github?.token ??
		process.env.GITHUB_TOKEN ??
		process.env.GH_TOKEN;

	if (!githubToken) {
		throw new Error(
			"GitHub token is required. Provide via --github-token, hatch.json, or GITHUB_TOKEN env var.",
		);
	}

	// GitHub org resolution (optional - uses authenticated user if not provided)
	const githubOrg =
		options.githubOrg ?? config?.github?.org ?? process.env.HATCH_GITHUB_ORG;

	// GitHub user info for git config (optional)
	const githubEmail = config?.github?.email ?? process.env.HATCH_GITHUB_EMAIL;
	const githubName = config?.github?.name ?? process.env.HATCH_GITHUB_NAME;

	// Vercel token resolution
	const vercelToken =
		options.vercelToken ?? config?.vercel?.token ?? process.env.VERCEL_TOKEN;

	if (!vercelToken) {
		throw new Error(
			"Vercel token is required. Provide via --vercel-token, hatch.json, or VERCEL_TOKEN env var.",
		);
	}

	// Vercel team resolution
	const vercelTeam =
		options.vercelTeam ?? config?.vercel?.team ?? process.env.HATCH_VERCEL_TEAM;

	if (!vercelTeam) {
		throw new Error(
			"Vercel team is required. Provide via --vercel-team, hatch.json, or HATCH_VERCEL_TEAM env var.",
		);
	}

	// Convex resolution (always required)
	const convexAccessToken =
		config?.convex?.accessToken ?? process.env.CONVEX_ACCESS_TOKEN;

	if (!convexAccessToken) {
		throw new Error(
			"Convex access token is required. Provide via hatch.json convex.accessToken or CONVEX_ACCESS_TOKEN env var.",
		);
	}

	return {
		github: {
			token: githubToken,
			org: githubOrg,
			email: githubEmail,
			name: githubName,
		},
		vercel: {
			token: vercelToken,
			team: vercelTeam,
		},
		convex: { accessToken: convexAccessToken },
		conflictStrategy: options.conflictStrategy ?? "suffix",
		json: options.json ?? false,
		quiet: options.quiet ?? false,
	};
}

/**
 * Validate that all required options are present for headless mode
 */
export function validateHeadlessOptions(options: HeadlessOptions): void {
	const errors: string[] = [];

	// These will be validated during resolveConfig, but we can do early validation
	// for options that have no fallback sources

	if (errors.length > 0) {
		throw new Error(`Invalid headless options:\n${errors.join("\n")}`);
	}
}
