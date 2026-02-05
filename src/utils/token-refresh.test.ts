import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs-extra", () => ({
	default: {
		pathExists: vi.fn(),
		readJson: vi.fn(),
		readFile: vi.fn(),
		writeJson: vi.fn(),
	},
}));

vi.mock("execa", () => ({
	execa: vi.fn(),
}));

vi.mock("./logger.js", () => ({
	log: {
		success: vi.fn(),
	},
}));

import { execa } from "execa";
import fs from "fs-extra";
import { refreshTokens } from "./token-refresh.js";

const mockFs = vi.mocked(fs);
const mockExeca = vi.mocked(execa);

describe("token-refresh utilities", () => {
	const originalPlatform = process.platform;
	const originalEnv = { ...process.env };

	beforeEach(() => {
		vi.clearAllMocks();
		process.env = { ...originalEnv };
		Object.defineProperty(process, "platform", { value: "darwin" });
	});

	afterEach(() => {
		Object.defineProperty(process, "platform", { value: originalPlatform });
		process.env = originalEnv;
	});

	describe("refreshTokens", () => {
		it("should update GitHub token from gh CLI", async () => {
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === "/config.json") {
					return {
						github: { token: "old_gh_token", org: "my-org" },
					} as never;
				}
				return {} as never;
			}) as never);
			mockFs.pathExists.mockResolvedValue(false as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
				if (cmd === "gh" && args?.includes("auth")) {
					return { stdout: "new_gh_token", stderr: "" } as never;
				}
				// Fail other commands to prevent reading other tokens
				throw new Error("Not found");
			}) as never);

			await refreshTokens("/config.json");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
					github: { token: "new_gh_token", org: "my-org" },
				}),
				{ spaces: 2 },
			);
		});

		it("should update Vercel token from CLI config", async () => {
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === "/config.json") {
					return {
						vercel: { token: "old_vercel_token", team: "my-team" },
					} as never;
				}
				// Vercel auth file
				if (path.includes("vercel") || path.includes("com.vercel.cli")) {
					return { token: "new_vercel_token" } as never;
				}
				return {} as never;
			}) as never);
			mockFs.pathExists.mockImplementation((async (path: string) => {
				if (path.includes("com.vercel.cli") || path.includes(".vercel")) {
					return true as never;
				}
				return false as never;
			}) as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);
			mockExeca.mockRejectedValue(new Error("Not found") as never);

			await refreshTokens("/config.json");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
					vercel: { token: "new_vercel_token", team: "my-team" },
				}),
				{ spaces: 2 },
			);
		});

		it("should update Supabase token from keychain on macOS", async () => {
			Object.defineProperty(process, "platform", { value: "darwin" });
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === "/config.json") {
					return {
						supabase: { token: "old_supabase_token", org: "my-org" },
					} as never;
				}
				return {} as never;
			}) as never);
			mockFs.pathExists.mockResolvedValue(false as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
				if (cmd === "security" && args?.includes("Supabase CLI")) {
					return { stdout: "new_supabase_token", stderr: "" } as never;
				}
				throw new Error("Not found");
			}) as never);

			await refreshTokens("/config.json");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
					supabase: { token: "new_supabase_token", org: "my-org" },
				}),
				{ spaces: 2 },
			);
		});

		it("should decode base64 Supabase token from keychain", async () => {
			Object.defineProperty(process, "platform", { value: "darwin" });
			const base64Token = Buffer.from("decoded_token").toString("base64");
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === "/config.json") {
					return {
						supabase: { token: "old", org: "org" },
					} as never;
				}
				return {} as never;
			}) as never);
			mockFs.pathExists.mockResolvedValue(false as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
				if (cmd === "security" && args?.includes("Supabase CLI")) {
					return {
						stdout: `go-keyring-base64:${base64Token}`,
						stderr: "",
					} as never;
				}
				throw new Error("Not found");
			}) as never);

			await refreshTokens("/config.json");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
					supabase: { token: "decoded_token", org: "org" },
				}),
				{ spaces: 2 },
			);
		});

		it("should preserve existing config settings when refreshing", async () => {
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === "/config.json") {
					return {
						github: { token: "old", org: "my-org", email: "me@example.com" },
						vercel: { token: "old", team: "my-team" },
						supabase: { token: "old", org: "sb-org", region: "us-east-1" },
						envVars: [{ key: "API_KEY", value: "secret" }],
					} as never;
				}
				return {} as never;
			}) as never);
			mockFs.pathExists.mockResolvedValue(false as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);
			mockExeca.mockRejectedValue(new Error("Not found") as never);

			await refreshTokens("/config.json");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
					github: expect.objectContaining({
						org: "my-org",
						email: "me@example.com",
					}),
					vercel: expect.objectContaining({ team: "my-team" }),
					supabase: expect.objectContaining({
						org: "sb-org",
						region: "us-east-1",
					}),
					envVars: [{ key: "API_KEY", value: "secret" }],
				}),
				{ spaces: 2 },
			);
		});

		it("should use environment variable for GitHub token", async () => {
			process.env.GITHUB_TOKEN = "env_gh_token";
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === "/config.json") {
					return {
						github: { token: "old" },
					} as never;
				}
				return {} as never;
			}) as never);
			mockFs.pathExists.mockResolvedValue(false as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await refreshTokens("/config.json");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
					github: { token: "env_gh_token" },
				}),
				{ spaces: 2 },
			);
		});

		it("should use GH_TOKEN environment variable", async () => {
			process.env.GH_TOKEN = "gh_env_token";
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === "/config.json") {
					return {
						github: { token: "old" },
					} as never;
				}
				return {} as never;
			}) as never);
			mockFs.pathExists.mockResolvedValue(false as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await refreshTokens("/config.json");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
					github: { token: "gh_env_token" },
				}),
				{ spaces: 2 },
			);
		});

		it("should use VERCEL_TOKEN environment variable", async () => {
			process.env.VERCEL_TOKEN = "vercel_env_token";
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === "/config.json") {
					return {
						vercel: { token: "old" },
					} as never;
				}
				return {} as never;
			}) as never);
			mockFs.pathExists.mockResolvedValue(false as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);
			mockExeca.mockRejectedValue(new Error("Not found") as never);

			await refreshTokens("/config.json");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
					vercel: { token: "vercel_env_token" },
				}),
				{ spaces: 2 },
			);
		});

		it("should use SUPABASE_ACCESS_TOKEN environment variable", async () => {
			process.env.SUPABASE_ACCESS_TOKEN = "supabase_env_token";
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === "/config.json") {
					return {
						supabase: { token: "old" },
					} as never;
				}
				return {} as never;
			}) as never);
			mockFs.pathExists.mockResolvedValue(false as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);
			mockExeca.mockRejectedValue(new Error("Not found") as never);

			await refreshTokens("/config.json");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
					supabase: { token: "supabase_env_token" },
				}),
				{ spaces: 2 },
			);
		});

		it("should update Claude credentials on macOS", async () => {
			Object.defineProperty(process, "platform", { value: "darwin" });
			mockFs.readJson.mockImplementation((async (path: string) => {
				if (path === "/config.json") {
					return {} as never;
				}
				// .claude.json doesn't exist
				throw new Error("Not found");
			}) as never);
			mockFs.pathExists.mockImplementation((async (path: string) => {
				// No .claude.json file
				return false as never;
			}) as never);
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

			await refreshTokens("/config.json");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/config.json",
				expect.objectContaining({
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
	});
});
