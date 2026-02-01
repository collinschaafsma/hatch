import os from "node:os";
import path from "node:path";
import { confirm } from "@inquirer/prompts";
import fs from "fs-extra";
import type { HatchConfig } from "../types/index.js";
import { log } from "./logger.js";

/**
 * Read current Vercel token from CLI config
 */
async function getCurrentVercelToken(): Promise<string | null> {
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
	return null;
}

/**
 * Check if tokens in hatch.json match current CLI configs
 * Returns true if tokens are fresh, false if stale
 */
export async function checkTokenFreshness(
	configPath: string,
): Promise<{ fresh: boolean; staleTokens: string[] }> {
	const staleTokens: string[] = [];

	if (!(await fs.pathExists(configPath))) {
		return { fresh: true, staleTokens: [] }; // No config to check
	}

	const config: HatchConfig = await fs.readJson(configPath);

	// Check Vercel token (most likely to be stale)
	const currentVercelToken = await getCurrentVercelToken();
	if (
		currentVercelToken &&
		config.vercel?.token &&
		currentVercelToken !== config.vercel.token
	) {
		staleTokens.push("Vercel");
	}

	return {
		fresh: staleTokens.length === 0,
		staleTokens,
	};
}

/**
 * Check tokens and prompt to refresh if stale
 * Returns true if should continue, false if user cancelled
 */
export async function checkAndPromptTokenRefresh(
	configPath: string,
): Promise<boolean> {
	const { fresh, staleTokens } = await checkTokenFreshness(configPath);

	if (fresh) {
		return true;
	}

	log.warn(`Stale tokens detected: ${staleTokens.join(", ")}`);
	log.info(
		"Your local CLI has newer tokens than your hatch config.",
	);
	log.blank();

	const shouldRefresh = await confirm({
		message: "Refresh tokens now? (recommended)",
		default: true,
	});

	if (shouldRefresh) {
		// Dynamically import to avoid circular deps
		const { refreshTokens } = await import("./token-refresh.js");
		await refreshTokens(configPath);
		log.blank();
		log.success("Tokens refreshed, continuing...");
		log.blank();
		return true;
	}

	const shouldContinue = await confirm({
		message: "Continue with stale tokens anyway?",
		default: false,
	});

	return shouldContinue;
}
