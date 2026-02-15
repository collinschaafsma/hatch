import type { ResolvedHeadlessConfig } from "../types/index.js";
import { checkRequiredClis, ghAuthStatus } from "./cli-wrappers.js";

export interface PrerequisiteCheckResult {
	passed: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Check all prerequisites for headless mode
 */
export async function checkPrerequisites(
	config: ResolvedHeadlessConfig,
): Promise<PrerequisiteCheckResult> {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check required CLIs are installed
	const { missing } = await checkRequiredClis();
	if (missing.length > 0) {
		errors.push(
			`Missing required CLIs: ${missing.join(", ")}. Use --bootstrap to install them.`,
		);
	}

	// Check GitHub authentication
	const ghStatus = await ghAuthStatus(config.github.token);
	if (!ghStatus.isAuthenticated) {
		errors.push(`GitHub CLI not authenticated: ${ghStatus.error}`);
	}

	// Skip Vercel auth check - whoami is unreliable, commands use --token directly

	return {
		passed: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Format prerequisite check results for display
 */
export function formatPrerequisiteResults(
	result: PrerequisiteCheckResult,
): string {
	const lines: string[] = [];

	if (result.errors.length > 0) {
		lines.push("Errors:");
		for (const error of result.errors) {
			lines.push(`  - ${error}`);
		}
	}

	if (result.warnings.length > 0) {
		lines.push("Warnings:");
		for (const warning of result.warnings) {
			lines.push(`  - ${warning}`);
		}
	}

	return lines.join("\n");
}
