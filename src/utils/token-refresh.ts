import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import yaml from "yaml";
import type { ClaudeConfig, HatchConfig } from "../types/index.js";
import { log } from "./logger.js";

/**
 * Read GitHub token using gh CLI
 */
async function readGitHubToken(): Promise<string | null> {
	if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
		return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
	}

	const { execa } = await import("execa");
	try {
		const result = await execa("gh", ["auth", "token"]);
		const token = result.stdout.trim();
		if (token) {
			return token;
		}
	} catch {
		// gh auth token failed
	}

	const configPath = path.join(os.homedir(), ".config", "gh", "hosts.yml");
	if (await fs.pathExists(configPath)) {
		try {
			const content = await fs.readFile(configPath, "utf-8");
			const config = yaml.parse(content);
			const githubConfig = config?.["github.com"];
			if (githubConfig?.oauth_token) {
				return githubConfig.oauth_token;
			}
		} catch {
			// Ignore parse errors
		}
	}

	return null;
}

/**
 * Read Vercel token from CLI config
 */
async function readVercelToken(): Promise<string | null> {
	const configPaths = [
		path.join(
			os.homedir(),
			"Library",
			"Application Support",
			"com.vercel.cli",
			"auth.json",
		),
		path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
		path.join(os.homedir(), ".vercel", "auth.json"),
	];

	for (const configPath of configPaths) {
		if (await fs.pathExists(configPath)) {
			try {
				const config = await fs.readJson(configPath);
				if (config?.token) {
					return config.token;
				}
			} catch {
				// Continue to next path
			}
		}
	}

	return process.env.VERCEL_TOKEN || null;
}

/**
 * Read Supabase token from CLI config or keychain
 */
async function readSupabaseToken(): Promise<string | null> {
	if (process.env.SUPABASE_ACCESS_TOKEN) {
		return process.env.SUPABASE_ACCESS_TOKEN;
	}

	const { execa } = await import("execa");

	if (process.platform === "darwin") {
		try {
			const result = await execa("security", [
				"find-generic-password",
				"-s",
				"Supabase CLI",
				"-w",
			]);
			const keychainValue = result.stdout.trim();
			if (keychainValue.startsWith("go-keyring-base64:")) {
				const base64Token = keychainValue.replace("go-keyring-base64:", "");
				return Buffer.from(base64Token, "base64").toString("utf-8");
			}
			if (keychainValue) {
				return keychainValue;
			}
		} catch {
			// Not in keychain
		}
	}

	const configPaths = [
		path.join(os.homedir(), ".supabase", "access-token"),
		path.join(os.homedir(), ".config", "supabase", "access-token"),
	];

	for (const configPath of configPaths) {
		if (await fs.pathExists(configPath)) {
			try {
				const token = await fs.readFile(configPath, "utf-8");
				return token.trim();
			} catch {
				// Continue to next path
			}
		}
	}

	return null;
}

/**
 * Read Claude Code OAuth credentials from platform-specific storage
 * - macOS: Keychain
 * - Linux: ~/.claude/.credentials.json
 */
async function getClaudeCredentials(): Promise<ClaudeConfig | undefined> {
	const { execa } = await import("execa");

	let oauth:
		| {
				accessToken?: string;
				refreshToken?: string;
				expiresAt?: number;
				scopes?: string[];
				subscriptionType?: string;
				rateLimitTier?: string;
		  }
		| undefined;

	// macOS: Read from Keychain
	if (process.platform === "darwin") {
		try {
			const { stdout } = await execa("security", [
				"find-generic-password",
				"-s",
				"Claude Code-credentials",
				"-w",
			]);
			const parsed = JSON.parse(stdout.trim());
			oauth = parsed.claudeAiOauth;
		} catch {
			return undefined;
		}
	} else {
		// Linux: Read from ~/.claude/.credentials.json
		const credentialsPath = path.join(
			os.homedir(),
			".claude",
			".credentials.json",
		);
		if (await fs.pathExists(credentialsPath)) {
			try {
				const parsed = await fs.readJson(credentialsPath);
				oauth = parsed.claudeAiOauth;
			} catch {
				return undefined;
			}
		} else {
			return undefined;
		}
	}

	if (!oauth?.accessToken || !oauth?.refreshToken) {
		return undefined;
	}

	const config: ClaudeConfig = {
		accessToken: oauth.accessToken,
		refreshToken: oauth.refreshToken,
		expiresAt: oauth.expiresAt,
		scopes: oauth.scopes || [],
	};
	if (oauth.subscriptionType) {
		config.subscriptionType = oauth.subscriptionType;
	}
	if (oauth.rateLimitTier) {
		config.rateLimitTier = oauth.rateLimitTier;
	}

	// Also read oauthAccount from ~/.claude.json if it exists
	const claudeJsonPath = path.join(os.homedir(), ".claude.json");
	if (await fs.pathExists(claudeJsonPath)) {
		try {
			const claudeJson = await fs.readJson(claudeJsonPath);
			if (claudeJson.oauthAccount) {
				config.oauthAccount = {
					accountUuid: claudeJson.oauthAccount.accountUuid,
					emailAddress: claudeJson.oauthAccount.emailAddress,
					organizationUuid: claudeJson.oauthAccount.organizationUuid,
					displayName: claudeJson.oauthAccount.displayName,
					organizationName: claudeJson.oauthAccount.organizationName,
					organizationRole: claudeJson.oauthAccount.organizationRole,
				};
			}
		} catch {
			// Ignore errors
		}
	}

	return config;
}

/**
 * Check if Claude token is expired or about to expire (5 minute buffer)
 */
export function isClaudeTokenExpired(config: HatchConfig): boolean {
	if (!config.claude?.expiresAt) return true;
	// 5 minute buffer before expiry
	return config.claude.expiresAt < Date.now() + 5 * 60 * 1000;
}

/**
 * Refresh only Claude credentials in an existing config file
 * Returns true if refresh succeeded, false if credentials couldn't be read
 */
export async function refreshClaudeTokenOnly(
	configPath: string,
): Promise<boolean> {
	const claudeCredentials = await getClaudeCredentials();
	if (!claudeCredentials) return false;

	const existingConfig: HatchConfig = await fs.readJson(configPath);
	existingConfig.claude = claudeCredentials;
	await fs.writeJson(configPath, existingConfig, { spaces: 2 });
	return true;
}

/**
 * Refresh tokens in an existing config file
 */
export async function refreshTokens(configPath: string): Promise<void> {
	const existingConfig: HatchConfig = await fs.readJson(configPath);

	const githubToken = await readGitHubToken();
	const vercelToken = await readVercelToken();
	const supabaseToken = await readSupabaseToken();
	const claudeCredentials = await getClaudeCredentials();

	if (githubToken && existingConfig.github) {
		existingConfig.github.token = githubToken;
		log.success("GitHub token refreshed");
	}

	if (vercelToken && existingConfig.vercel) {
		existingConfig.vercel.token = vercelToken;
		log.success("Vercel token refreshed");
	}

	if (supabaseToken && existingConfig.supabase) {
		existingConfig.supabase.token = supabaseToken;
		log.success("Supabase token refreshed");
	}

	if (claudeCredentials) {
		existingConfig.claude = claudeCredentials;
		log.success("Claude Code credentials refreshed");
	}

	await fs.writeJson(configPath, existingConfig, { spaces: 2 });
}
