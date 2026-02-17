import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import type { ClaudeConfig, HatchConfig } from "../types/index.js";

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
		expiresAt: oauth.expiresAt ?? 0,
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
export function isClaudeTokenExpired(config: Partial<HatchConfig>): boolean {
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
