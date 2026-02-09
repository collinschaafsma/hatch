import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs-extra", () => ({
	default: {
		pathExists: vi.fn(),
		readJson: vi.fn(),
		writeJson: vi.fn(),
	},
}));

vi.mock("execa", () => ({
	execa: vi.fn(),
}));

import { execa } from "execa";
import fs from "fs-extra";
import {
	isClaudeTokenExpired,
	refreshClaudeTokenOnly,
} from "./token-refresh.js";

const mockFs = vi.mocked(fs);
const mockExeca = vi.mocked(execa);

describe("token-refresh utilities", () => {
	const originalPlatform = process.platform;

	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(process, "platform", { value: "darwin" });
	});

	afterEach(() => {
		Object.defineProperty(process, "platform", { value: originalPlatform });
	});

	describe("isClaudeTokenExpired", () => {
		it("should return true when no expiresAt", () => {
			expect(isClaudeTokenExpired({})).toBe(true);
			expect(isClaudeTokenExpired({ claude: {} as never })).toBe(true);
		});

		it("should return true when token is expired", () => {
			const config = {
				claude: {
					accessToken: "token",
					refreshToken: "refresh",
					expiresAt: Date.now() - 1000,
					scopes: [],
				},
			};
			expect(isClaudeTokenExpired(config)).toBe(true);
		});

		it("should return true when token expires within 5 minutes", () => {
			const config = {
				claude: {
					accessToken: "token",
					refreshToken: "refresh",
					expiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes from now
					scopes: [],
				},
			};
			expect(isClaudeTokenExpired(config)).toBe(true);
		});

		it("should return false when token is not expired", () => {
			const config = {
				claude: {
					accessToken: "token",
					refreshToken: "refresh",
					expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
					scopes: [],
				},
			};
			expect(isClaudeTokenExpired(config)).toBe(false);
		});
	});

	describe("refreshClaudeTokenOnly", () => {
		it("should return false when credentials cannot be read", async () => {
			mockExeca.mockRejectedValue(new Error("Not found") as never);

			const result = await refreshClaudeTokenOnly("/config.json");

			expect(result).toBe(false);
			expect(mockFs.writeJson).not.toHaveBeenCalled();
		});

		it("should update Claude credentials in config file", async () => {
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === "/config.json") {
					return {
						github: { token: "gh_token" },
						vercel: { token: "vercel_token" },
					} as never;
				}
				throw new Error("Not found");
			}) as never);
			mockFs.pathExists.mockResolvedValue(false as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
				if (cmd === "security" && args?.includes("Claude Code-credentials")) {
					return {
						stdout: JSON.stringify({
							claudeAiOauth: {
								accessToken: "claude_access",
								refreshToken: "claude_refresh",
								expiresAt: 1234567890,
								scopes: ["read", "write"],
							},
						}),
						stderr: "",
					} as never;
				}
				throw new Error("Not found");
			}) as never);

			const result = await refreshClaudeTokenOnly("/config.json");

			expect(result).toBe(true);
			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
					github: { token: "gh_token" },
					vercel: { token: "vercel_token" },
					claude: expect.objectContaining({
						accessToken: "claude_access",
						refreshToken: "claude_refresh",
						expiresAt: 1234567890,
						scopes: ["read", "write"],
					}),
				}),
				{ spaces: 2 },
			);
		});

		it("should return false when oauth has no access token", async () => {
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
				if (cmd === "security" && args?.includes("Claude Code-credentials")) {
					return {
						stdout: JSON.stringify({
							claudeAiOauth: {
								refreshToken: "refresh_only",
							},
						}),
						stderr: "",
					} as never;
				}
				throw new Error("Not found");
			}) as never);

			const result = await refreshClaudeTokenOnly("/config.json");

			expect(result).toBe(false);
		});

		it("should read credentials from file on Linux", async () => {
			Object.defineProperty(process, "platform", { value: "linux" });

			const credentialsPath = `${os.homedir()}/.claude/.credentials.json`;
			mockFs.pathExists.mockImplementation((async (path: string) => {
				if (path === credentialsPath) return true as never;
				return false as never;
			}) as never);
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === credentialsPath) {
					return {
						claudeAiOauth: {
							accessToken: "linux_access",
							refreshToken: "linux_refresh",
							expiresAt: 9999999999,
							scopes: [],
						},
					} as never;
				}
				if (path === "/config.json") {
					return {} as never;
				}
				throw new Error("Not found");
			}) as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			const result = await refreshClaudeTokenOnly("/config.json");

			expect(result).toBe(true);
			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
					claude: expect.objectContaining({
						accessToken: "linux_access",
						refreshToken: "linux_refresh",
					}),
				}),
				{ spaces: 2 },
			);
		});
	});
});
