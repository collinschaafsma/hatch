import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs-extra", () => ({
	default: {
		pathExists: vi.fn(),
		readJson: vi.fn(),
	},
}));

vi.mock("@inquirer/prompts", () => ({
	confirm: vi.fn(),
}));

vi.mock("./logger.js", () => ({
	log: {
		info: vi.fn(),
		warn: vi.fn(),
		success: vi.fn(),
		blank: vi.fn(),
	},
}));

vi.mock("./token-refresh.js", () => ({
	refreshTokens: vi.fn(),
}));

import { confirm } from "@inquirer/prompts";
import fs from "fs-extra";
import {
	checkAndPromptTokenRefresh,
	checkTokenFreshness,
} from "./token-check.js";
import { refreshTokens } from "./token-refresh.js";

const mockFs = vi.mocked(fs);
const mockConfirm = vi.mocked(confirm);
const mockRefreshTokens = vi.mocked(refreshTokens);

describe("token-check utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("checkTokenFreshness", () => {
		it("should return fresh when config file does not exist", async () => {
			mockFs.pathExists.mockResolvedValue(false as never);

			const result = await checkTokenFreshness("/path/to/config.json");

			expect(result).toEqual({ fresh: true, staleTokens: [] });
		});

		it("should return fresh when tokens match", async () => {
			const token = "vercel_token_123";
			mockFs.pathExists.mockImplementation(async (path: string) => {
				if (path === "/path/to/config.json") return true as never;
				// Simulate Vercel config exists
				if (path.includes("com.vercel.cli") || path.includes(".vercel")) {
					return true as never;
				}
				return false as never;
			});
			mockFs.readJson.mockImplementation(async (path: string) => {
				if (path === "/path/to/config.json") {
					return { vercel: { token } } as never;
				}
				// Return same token from Vercel CLI config
				return { token } as never;
			});

			const result = await checkTokenFreshness("/path/to/config.json");

			expect(result).toEqual({ fresh: true, staleTokens: [] });
		});

		it("should detect stale Vercel token", async () => {
			mockFs.pathExists.mockImplementation(async (path: string) => {
				if (path === "/path/to/config.json") return true as never;
				if (path.includes("com.vercel.cli") || path.includes(".vercel")) {
					return true as never;
				}
				return false as never;
			});
			mockFs.readJson.mockImplementation(async (path: string) => {
				if (path === "/path/to/config.json") {
					return { vercel: { token: "old_token" } } as never;
				}
				// Different token from Vercel CLI
				return { token: "new_token" } as never;
			});

			const result = await checkTokenFreshness("/path/to/config.json");

			expect(result).toEqual({ fresh: false, staleTokens: ["Vercel"] });
		});

		it("should return fresh when no Vercel token in config", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({ github: { token: "gh_token" } } as never);

			const result = await checkTokenFreshness("/path/to/config.json");

			expect(result).toEqual({ fresh: true, staleTokens: [] });
		});

		it("should return fresh when Vercel CLI has no token", async () => {
			mockFs.pathExists.mockImplementation(async (path: string) => {
				if (path === "/path/to/config.json") return true as never;
				return false as never; // No Vercel CLI config
			});
			mockFs.readJson.mockResolvedValue({
				vercel: { token: "some_token" },
			} as never);

			const result = await checkTokenFreshness("/path/to/config.json");

			expect(result).toEqual({ fresh: true, staleTokens: [] });
		});
	});

	describe("checkAndPromptTokenRefresh", () => {
		it("should return true when tokens are fresh", async () => {
			mockFs.pathExists.mockResolvedValue(false as never);

			const result = await checkAndPromptTokenRefresh("/path/to/config.json");

			expect(result).toBe(true);
			expect(mockConfirm).not.toHaveBeenCalled();
		});

		it("should refresh tokens when user confirms", async () => {
			mockFs.pathExists.mockImplementation(async (path: string) => {
				if (path === "/path/to/config.json") return true as never;
				if (path.includes("com.vercel.cli") || path.includes(".vercel")) {
					return true as never;
				}
				return false as never;
			});
			mockFs.readJson.mockImplementation(async (path: string) => {
				if (path === "/path/to/config.json") {
					return { vercel: { token: "old" } } as never;
				}
				return { token: "new" } as never;
			});
			mockConfirm.mockResolvedValue(true as never);
			mockRefreshTokens.mockResolvedValue(undefined as never);

			const result = await checkAndPromptTokenRefresh("/path/to/config.json");

			expect(result).toBe(true);
			expect(mockRefreshTokens).toHaveBeenCalledWith("/path/to/config.json");
		});

		it("should prompt to continue when user declines refresh", async () => {
			mockFs.pathExists.mockImplementation(async (path: string) => {
				if (path === "/path/to/config.json") return true as never;
				if (path.includes("com.vercel.cli") || path.includes(".vercel")) {
					return true as never;
				}
				return false as never;
			});
			mockFs.readJson.mockImplementation(async (path: string) => {
				if (path === "/path/to/config.json") {
					return { vercel: { token: "old" } } as never;
				}
				return { token: "new" } as never;
			});
			// First confirm: decline refresh
			// Second confirm: accept continue with stale
			mockConfirm
				.mockResolvedValueOnce(false as never)
				.mockResolvedValueOnce(true as never);

			const result = await checkAndPromptTokenRefresh("/path/to/config.json");

			expect(result).toBe(true);
			expect(mockRefreshTokens).not.toHaveBeenCalled();
			expect(mockConfirm).toHaveBeenCalledTimes(2);
		});

		it("should return false when user declines both prompts", async () => {
			mockFs.pathExists.mockImplementation(async (path: string) => {
				if (path === "/path/to/config.json") return true as never;
				if (path.includes("com.vercel.cli") || path.includes(".vercel")) {
					return true as never;
				}
				return false as never;
			});
			mockFs.readJson.mockImplementation(async (path: string) => {
				if (path === "/path/to/config.json") {
					return { vercel: { token: "old" } } as never;
				}
				return { token: "new" } as never;
			});
			mockConfirm
				.mockResolvedValueOnce(false as never)
				.mockResolvedValueOnce(false as never);

			const result = await checkAndPromptTokenRefresh("/path/to/config.json");

			expect(result).toBe(false);
		});
	});
});
