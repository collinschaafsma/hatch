import type { HeadlessResult } from "../types/index.js";
import { log } from "../utils/logger.js";

/**
 * Generate next steps instructions based on the setup results
 */
export function generateNextSteps(result: HeadlessResult): string[] {
	const steps: string[] = [];

	// Convex dashboard
	if (result.convex) {
		steps.push(
			`Convex dashboard: ${result.convex.deploymentUrl || "https://dashboard.convex.dev"}`,
		);
	}

	// Preview deploy key
	if (result.convex) {
		steps.push(
			`Set up Convex preview deployments: generate a preview deploy key at https://dashboard.convex.dev then run: hatch set-preview-deploy-key <key> --project ${result.project?.name || "<project-name>"}`,
		);
	}

	// Better Auth env vars
	steps.push("Add RESEND_API_KEY to Vercel env vars (from resend.com)");

	// AI Gateway
	steps.push(
		"Add AI_GATEWAY_API_KEY to Vercel env vars (from Vercel AI Gateway)",
	);

	// PostHog (optional)
	steps.push(
		"(Optional) Add NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST for analytics",
	);

	return steps;
}

/**
 * Output results as JSON
 */
export function outputJson(result: HeadlessResult): void {
	console.log(JSON.stringify(result, null, 2));
}

/**
 * Output results in human-readable format
 */
export function outputHuman(result: HeadlessResult): void {
	if (!result.success) {
		log.error(`Setup failed: ${result.error}`);
		return;
	}

	log.blank();
	log.success("Headless setup completed successfully!");
	log.blank();

	if (result.project) {
		log.info("Project:");
		log.step(`Name: ${result.project.name}`);
		log.step(`Path: ${result.project.path}`);
	}

	if (result.github) {
		log.blank();
		log.info("GitHub:");
		log.step(`URL: ${result.github.url}`);
	}

	if (result.convex) {
		log.blank();
		log.info("Convex:");
		log.step(`URL: ${result.convex.deploymentUrl}`);
		log.step(`Project: ${result.convex.projectSlug}`);
	}

	if (result.vercel) {
		log.blank();
		log.info("Vercel:");
		log.step(`URL: ${result.vercel.url}`);
		log.step(`Project: ${result.vercel.projectName}`);
	}

	if (result.nextSteps && result.nextSteps.length > 0) {
		log.blank();
		log.info("Next Steps:");
		for (const step of result.nextSteps) {
			log.step(step);
		}
	}

	log.blank();
}

/**
 * Output result based on format preference
 */
export function outputResult(
	result: HeadlessResult,
	json: boolean,
	quiet: boolean,
): void {
	if (json) {
		outputJson(result);
	} else if (!quiet) {
		outputHuman(result);
	}
}

/**
 * Create a failure result
 */
export function createFailureResult(error: Error | string): HeadlessResult {
	return {
		success: false,
		error: error instanceof Error ? error.message : error,
	};
}

/**
 * Create a success result
 */
export function createSuccessResult(
	data: Omit<HeadlessResult, "success">,
): HeadlessResult {
	return {
		success: true,
		...data,
	};
}
