import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSpinner, withSpinner } from "./spinner.js";

vi.mock("ora", () => {
	const mockSpinner = {
		start: vi.fn().mockReturnThis(),
		succeed: vi.fn().mockReturnThis(),
		fail: vi.fn().mockReturnThis(),
		stop: vi.fn().mockReturnThis(),
		text: "",
		color: "cyan" as const,
	};
	return {
		default: vi.fn(() => mockSpinner),
		__mockSpinner: mockSpinner,
	};
});

import ora from "ora";

const mockOra = vi.mocked(ora);

describe("spinner utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createSpinner", () => {
		it("should create ora spinner with cyan color", () => {
			createSpinner("Loading...");
			expect(mockOra).toHaveBeenCalledWith({
				text: "Loading...",
				color: "cyan",
			});
		});

		it("should return spinner instance", () => {
			const spinner = createSpinner("Test");
			expect(spinner).toBeDefined();
			expect(spinner.start).toBeDefined();
			expect(spinner.succeed).toBeDefined();
			expect(spinner.fail).toBeDefined();
		});
	});

	describe("withSpinner", () => {
		it("should start spinner before executing function", async () => {
			const mockFn = vi.fn().mockResolvedValue("result");
			await withSpinner("Loading...", mockFn);
			const spinner = mockOra.mock.results[0].value;
			expect(spinner.start).toHaveBeenCalled();
		});

		it("should succeed spinner when function resolves", async () => {
			const mockFn = vi.fn().mockResolvedValue("result");
			await withSpinner("Loading...", mockFn);
			const spinner = mockOra.mock.results[0].value;
			expect(spinner.succeed).toHaveBeenCalled();
		});

		it("should fail spinner when function rejects", async () => {
			const mockFn = vi.fn().mockRejectedValue(new Error("Failed"));
			await expect(withSpinner("Loading...", mockFn)).rejects.toThrow("Failed");
			const spinner = mockOra.mock.results[0].value;
			expect(spinner.fail).toHaveBeenCalled();
		});

		it("should return result from function", async () => {
			const mockFn = vi.fn().mockResolvedValue({ data: "test" });
			const result = await withSpinner("Loading...", mockFn);
			expect(result).toEqual({ data: "test" });
		});

		it("should rethrow errors after failing spinner", async () => {
			const error = new Error("Test error");
			const mockFn = vi.fn().mockRejectedValue(error);
			await expect(withSpinner("Loading...", mockFn)).rejects.toThrow(error);
		});
	});
});
