import type { ResolvedHeadlessConfig } from "../types/index.js";
import {
	checkRequiredClis,
	ghAuthStatus,
	supabaseAuthStatus,
} from "./cli-wrappers.js";

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
	// Filter out supabase if using Convex backend
	const relevantMissing =
		config.backendProvider === "convex"
			? missing.filter((cli) => cli !== "supabase")
			: missing;
	if (relevantMissing.length > 0) {
		errors.push(
			`Missing required CLIs: ${relevantMissing.join(", ")}. Use --bootstrap to install them.`,
		);
	}

	// Check GitHub authentication
	const ghStatus = await ghAuthStatus(config.github.token);
	if (!ghStatus.isAuthenticated) {
		errors.push(`GitHub CLI not authenticated: ${ghStatus.error}`);
	}

	// Skip Vercel auth check - whoami is unreliable, commands use --token directly

	// Check Supabase authentication (skip for Convex backend)
	if (config.backendProvider !== "convex" && config.supabase) {
		const supabaseStatus = await supabaseAuthStatus(config.supabase.token);
		if (!supabaseStatus.isAuthenticated) {
			errors.push(`Supabase CLI not authenticated: ${supabaseStatus.error}`);
		}
	}

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
