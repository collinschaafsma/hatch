export function generateObservedModel(): string {
	return `import { openai } from "@ai-sdk/openai";
import { withTracing } from "@posthog/ai";
import type { LanguageModel } from "ai";
import getPostHogClient from "@/lib/posthog";

/**
 * Creates an observed language model with automatic tracing.
 *
 * When running in Evalite context (EVALITE env var set), uses Evalite's AI SDK
 * wrapper for automatic tracing and caching in the Evalite UI.
 *
 * Otherwise, uses PostHog for production observability (if configured).
 *
 * @param model - Model name (e.g., "gpt-4o", "gpt-4o-mini")
 * @param posthogProperties - Optional properties to include in PostHog traces
 */
export function observedModel(
	model: string,
	posthogProperties: Record<string, unknown> = {},
): LanguageModel {
	const modelClient = openai(model);

	// Detect if running in Evalite context
	const isEvaliteContext = process.env.EVALITE === "true";

	if (isEvaliteContext) {
		// In eval context: use Evalite's AI SDK wrapper for tracing/caching
		// Dynamic import to avoid requiring evalite in production
		try {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { wrapAISDKModel } = require("evalite/ai-sdk");
			return wrapAISDKModel(modelClient);
		} catch (error) {
			// If evalite not available, fall back to unwrapped model
			console.warn("Evalite not available, using unwrapped model:", error);
			return modelClient;
		}
	}

	// Production context: use PostHog tracing if configured
	const posthogClient = getPostHogClient();
	if (!posthogClient) {
		// PostHog not configured, return unwrapped model
		return modelClient;
	}

	const tracedModel = withTracing(modelClient, posthogClient, {
		posthogProperties,
	});

	return tracedModel;
}
`;
}
