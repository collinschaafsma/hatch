import { describe, expect, it } from "vitest";
import { isAnthropicKeyMissing } from "./token-refresh.js";

describe("token-refresh utilities", () => {
	describe("isAnthropicKeyMissing", () => {
		it("should return true when no anthropicApiKey", () => {
			expect(isAnthropicKeyMissing({})).toBe(true);
		});

		it("should return true when anthropicApiKey is empty string", () => {
			expect(isAnthropicKeyMissing({ anthropicApiKey: "" })).toBe(true);
		});

		it("should return false when anthropicApiKey is present", () => {
			expect(
				isAnthropicKeyMissing({ anthropicApiKey: "sk-ant-api03-..." }),
			).toBe(false);
		});
	});
});
