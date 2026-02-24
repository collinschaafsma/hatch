import type { HatchConfig } from "../types/index.js";

/**
 * Check if the Anthropic API key is missing from the config
 */
export function isAnthropicKeyMissing(config: Partial<HatchConfig>): boolean {
	return !config.anthropicApiKey;
}
