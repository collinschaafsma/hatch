import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("prompts", () => ({
	default: vi.fn(),
}));

import prompts from "prompts";
import { getProjectPrompts } from "./prompts.js";

const mockPrompts = vi.mocked(prompts);

describe("prompts utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getProjectPrompts", () => {
		it("should skip prompt when initialName is provided", async () => {
			mockPrompts.mockResolvedValueOnce({});
			const result = await getProjectPrompts("my-project", false);
			expect(result.projectName).toBe("my-project");
			// The prompt should still be called but with type: null for the name question
			expect(mockPrompts).toHaveBeenCalled();
		});

		it("should prompt for name when initialName is undefined", async () => {
			mockPrompts.mockResolvedValueOnce({ projectName: "user-input" });
			const result = await getProjectPrompts(undefined, false);
			expect(result.projectName).toBe("user-input");
		});

		it("should return useWorkOS flag as false by default", async () => {
			mockPrompts.mockResolvedValueOnce({});
			const result = await getProjectPrompts("my-project");
			expect(result.useWorkOS).toBe(false);
		});

		it("should return useWorkOS flag as true when specified", async () => {
			mockPrompts.mockResolvedValueOnce({});
			const result = await getProjectPrompts("my-project", true);
			expect(result.useWorkOS).toBe(true);
		});

		it("should use initialName over prompt response", async () => {
			mockPrompts.mockResolvedValueOnce({ projectName: "prompt-response" });
			const result = await getProjectPrompts("initial-name", false);
			expect(result.projectName).toBe("initial-name");
		});
	});

	describe("validateProjectName (via integration)", () => {
		it("should accept valid npm package names", async () => {
			// Test that the validate function is passed to prompts
			mockPrompts.mockResolvedValueOnce({ projectName: "valid-name" });
			await getProjectPrompts(undefined, false);

			const promptsCall = mockPrompts.mock.calls[0][0] as Array<{
				validate?: (name: string) => boolean | string;
			}>;
			const nameQuestion = promptsCall[0];

			if (nameQuestion.validate) {
				expect(nameQuestion.validate("valid-name")).toBe(true);
				expect(nameQuestion.validate("@scope/package")).toBe(true);
				expect(nameQuestion.validate("my-app")).toBe(true);
			}
		});

		it("should reject invalid npm package names", async () => {
			mockPrompts.mockResolvedValueOnce({ projectName: "valid" });
			await getProjectPrompts(undefined, false);

			const promptsCall = mockPrompts.mock.calls[0][0] as Array<{
				validate?: (name: string) => boolean | string;
			}>;
			const nameQuestion = promptsCall[0];

			if (nameQuestion.validate) {
				// Names starting with . or _ are invalid for new packages
				expect(nameQuestion.validate(".invalid")).not.toBe(true);
				expect(nameQuestion.validate("_invalid")).not.toBe(true);
				// Names with spaces are invalid
				expect(nameQuestion.validate("invalid name")).not.toBe(true);
				// Capital letters are invalid
				expect(nameQuestion.validate("InvalidName")).not.toBe(true);
			}
		});
	});
});
