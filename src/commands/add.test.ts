import {
	type MockInstance,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createMockProjectRecord } from "../__tests__/mocks/stores.js";

vi.mock("fs-extra", () => ({
	default: {
		pathExists: vi.fn(),
		readJson: vi.fn(),
		writeJson: vi.fn(),
		readFile: vi.fn(),
		writeFile: vi.fn(),
		ensureDir: vi.fn(),
	},
}));

vi.mock("execa", () => ({
	execa: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
	input: vi.fn(),
	confirm: vi.fn(),
}));

vi.mock("../utils/project-store.js", () => ({
	getProject: vi.fn(),
	saveProject: vi.fn(),
}));

vi.mock("../headless/cli-wrappers.js", () => ({
	vercelGetProjectUrl: vi.fn(),
}));

vi.mock("../utils/config-resolver.js", () => ({
	resolveConfigPath: vi.fn().mockResolvedValue("/mock/.hatch.json"),
	getProjectConfigPath: vi
		.fn()
		.mockResolvedValue("/mock/.hatch/configs/my-project.json"),
}));

vi.mock("../utils/exec.js", () => ({
	gitAdd: vi.fn().mockResolvedValue(undefined),
	gitCheckout: vi.fn().mockResolvedValue(undefined),
	gitCommit: vi.fn().mockResolvedValue(undefined),
	gitPull: vi.fn().mockResolvedValue(undefined),
	gitPush: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/harness-scaffold.js", () => ({
	scaffoldHarness: vi.fn().mockResolvedValue({ written: [], skipped: [] }),
	mergeHarnessPackageJsonScripts: vi.fn().mockResolvedValue(false),
}));

vi.mock("../utils/logger.js", () => ({
	log: {
		info: vi.fn(),
		success: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		step: vi.fn(),
		blank: vi.fn(),
	},
}));

vi.mock("../utils/spinner.js", () => ({
	createSpinner: vi.fn(() => ({
		start: vi.fn().mockReturnThis(),
		succeed: vi.fn(),
		fail: vi.fn(),
		warn: vi.fn(),
	})),
}));

import { confirm, input } from "@inquirer/prompts";
import { execa } from "execa";
import fs from "fs-extra";
import { vercelGetProjectUrl } from "../headless/cli-wrappers.js";
import { log } from "../utils/logger.js";
import { getProject, saveProject } from "../utils/project-store.js";
import { addCommand } from "./add.js";

const mockInput = vi.mocked(input);
const mockConfirm = vi.mocked(confirm);
const mockExeca = vi.mocked(execa);
const mockFs = vi.mocked(fs);
const mockGetProject = vi.mocked(getProject);
const mockSaveProject = vi.mocked(saveProject);
const mockVercelGetProjectUrl = vi.mocked(vercelGetProjectUrl);
const mockLog = vi.mocked(log);

describe("add command", () => {
	let mockExit: MockInstance;

	beforeEach(() => {
		vi.clearAllMocks();
		mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit called");
		});
		mockFs.pathExists.mockResolvedValue(false as never);
		mockFs.readJson.mockResolvedValue({} as never);
		mockFs.writeJson.mockResolvedValue(undefined as never);
		mockFs.readFile.mockResolvedValue("" as never);
		mockFs.writeFile.mockResolvedValue(undefined as never);
		mockFs.ensureDir.mockResolvedValue(undefined as never);
		// Default: decline all confirm prompts
		mockConfirm.mockResolvedValue(false);
	});

	afterEach(() => {
		mockExit.mockRestore();
	});

	describe("existing project check", () => {
		it("should error when project already exists", async () => {
			mockGetProject.mockResolvedValue(createMockProjectRecord());

			await expect(
				addCommand.parseAsync(["node", "test", "existing-project"]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith(
				'Project "existing-project" already exists in the store.',
			);
		});
	});

	describe("GitHub lookup", () => {
		it("should error when GitHub is not provided", async () => {
			mockGetProject.mockResolvedValue(undefined);
			mockExeca.mockRejectedValue(new Error("Not found"));
			mockInput.mockResolvedValue("");

			await expect(
				addCommand.parseAsync(["node", "test", "my-project"]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith("GitHub repo is required.");
		});
	});

	describe("Vercel lookup", () => {
		it("should error when Vercel is not provided", async () => {
			mockGetProject.mockResolvedValue(undefined);
			mockExeca.mockImplementation((async (cmd: string) => {
				if (cmd === "gh") {
					return {
						stdout: JSON.stringify({
							url: "https://github.com/o/r",
							owner: { login: "o" },
							name: "r",
						}),
						stderr: "",
					} as never;
				}
				if (cmd === "vercel") {
					return { stdout: "", stderr: "" } as never;
				}
				throw new Error("Not found");
			}) as never);
			// Vercel prompts return empty
			mockInput.mockResolvedValueOnce("");

			await expect(
				addCommand.parseAsync(["node", "test", "my-project"]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith("Vercel project is required.");
		});

		it("should prompt for Vercel info when not found", async () => {
			mockGetProject.mockResolvedValue(undefined);
			// pathExists: true for .git check, false for everything else
			mockFs.pathExists.mockImplementation(((p: string) =>
				Promise.resolve(p.endsWith(".git"))) as never);
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
				if (cmd === "gh") {
					if (args?.includes("pr")) {
						return {
							stdout: "https://github.com/o/r/pull/1",
							stderr: "",
						} as never;
					}
					return {
						stdout: JSON.stringify({
							url: "https://github.com/o/r",
							owner: { login: "o" },
							name: "r",
						}),
						stderr: "",
					} as never;
				}
				if (cmd === "vercel") {
					return { stdout: "other-project", stderr: "" } as never;
				}
				if (cmd === "npx") {
					return { stdout: "", stderr: "" } as never;
				}
				if (cmd === "git") {
					return { stdout: "", stderr: "" } as never;
				}
				throw new Error("Not found");
			}) as never);
			// Vercel project ID, Vercel URL
			mockInput
				.mockResolvedValueOnce("manual_id")
				.mockResolvedValueOnce("https://custom.vercel.app");
			mockSaveProject.mockResolvedValue(undefined);
			// Decline per-project config, decline doc population
			mockConfirm.mockResolvedValue(false);

			await addCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--path",
				"/tmp/fake",
			]);

			expect(mockSaveProject).toHaveBeenCalledWith(
				expect.objectContaining({
					vercel: expect.objectContaining({
						projectId: "manual_id",
						url: "https://custom.vercel.app",
					}),
				}),
			);
		});
	});

	describe("save project", () => {
		it("should save project record with all details", async () => {
			mockGetProject.mockResolvedValue(undefined);
			// pathExists: true for .git check, false for everything else
			mockFs.pathExists.mockImplementation(((p: string) =>
				Promise.resolve(p.endsWith(".git"))) as never);
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
				if (cmd === "gh") {
					if (args?.includes("pr")) {
						return {
							stdout: "https://github.com/org/repo/pull/1",
							stderr: "",
						} as never;
					}
					return {
						stdout: JSON.stringify({
							url: "https://github.com/org/repo",
							owner: { login: "org" },
							name: "repo",
						}),
						stderr: "",
					} as never;
				}
				if (cmd === "vercel" && args?.includes("inspect")) {
					return { stdout: "ID\t\t\t\tprj_123", stderr: "" } as never;
				}
				if (cmd === "npx") {
					return { stdout: "", stderr: "" } as never;
				}
				if (cmd === "git") {
					return { stdout: "", stderr: "" } as never;
				}
				throw new Error("Not found");
			}) as never);
			mockVercelGetProjectUrl.mockResolvedValue({
				url: "https://my-project.vercel.app",
				hasAlias: true,
			});
			mockSaveProject.mockResolvedValue(undefined);
			// Decline per-project config, decline doc population
			mockConfirm.mockResolvedValue(false);

			await addCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--path",
				"/tmp/fake",
			]);

			expect(mockSaveProject).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "my-project",
					createdAt: expect.any(String),
					github: {
						url: "https://github.com/org/repo",
						owner: "org",
						repo: "repo",
					},
					vercel: {
						projectId: "prj_123",
						url: "https://my-project.vercel.app",
					},
				}),
			);
			expect(mockLog.success).toHaveBeenCalledWith(
				"Project added successfully!",
			);
		});
	});

	describe("per-project config", () => {
		it("should write per-project config when accepted", async () => {
			mockGetProject.mockResolvedValue(undefined);
			// true for .git check and config file
			mockFs.pathExists.mockImplementation(((p: string) =>
				Promise.resolve(
					p.endsWith(".git") || p.endsWith(".hatch.json"),
				)) as never);
			mockFs.readJson.mockResolvedValue({
				github: { token: "gh_tok", org: "my-org", email: "e", name: "n" },
				vercel: { token: "vc_tok", team: "my-team" },
				convex: { accessToken: "cvx_tok" },
			} as never);
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
				if (cmd === "gh") {
					if (args?.includes("pr")) {
						return {
							stdout: "https://github.com/o/r/pull/1",
							stderr: "",
						} as never;
					}
					return {
						stdout: JSON.stringify({
							url: "https://github.com/o/r",
							owner: { login: "o" },
							name: "r",
						}),
						stderr: "",
					} as never;
				}
				if (cmd === "vercel" && args?.includes("inspect")) {
					return { stdout: "ID\t\t\t\tprj_1", stderr: "" } as never;
				}
				if (cmd === "npx" || cmd === "git") {
					return { stdout: "", stderr: "" } as never;
				}
				throw new Error("Not found");
			}) as never);
			mockVercelGetProjectUrl.mockResolvedValue({
				url: "https://my-project.vercel.app",
				hasAlias: true,
			});
			mockSaveProject.mockResolvedValue(undefined);
			// Accept per-project config, decline doc population
			mockConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

			await addCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--path",
				"/tmp/fake",
			]);

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				"/mock/.hatch/configs/my-project.json",
				expect.objectContaining({
					project: "my-project",
					github: expect.objectContaining({
						token: "gh_tok",
						org: "my-org",
					}),
					vercel: expect.objectContaining({
						token: "vc_tok",
						team: "my-team",
					}),
					convex: expect.objectContaining({
						accessToken: "cvx_tok",
					}),
				}),
				{ spaces: 2 },
			);
			expect(mockLog.success).toHaveBeenCalledWith(
				"Per-project config written to /mock/.hatch/configs/my-project.json",
			);
		});
	});

	describe("doc population", () => {
		it("should run claude to populate docs when accepted", async () => {
			mockGetProject.mockResolvedValue(undefined);
			mockFs.pathExists.mockImplementation(((p: string) =>
				Promise.resolve(p.endsWith(".git"))) as never);
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
				if (cmd === "gh") {
					if (args?.includes("pr")) {
						return {
							stdout: "https://github.com/o/r/pull/1",
							stderr: "",
						} as never;
					}
					return {
						stdout: JSON.stringify({
							url: "https://github.com/o/r",
							owner: { login: "o" },
							name: "r",
						}),
						stderr: "",
					} as never;
				}
				if (cmd === "vercel" && args?.includes("inspect")) {
					return { stdout: "ID\t\t\t\tprj_1", stderr: "" } as never;
				}
				if (cmd === "npx" || cmd === "git" || cmd === "claude") {
					return { stdout: "", stderr: "" } as never;
				}
				throw new Error("Not found");
			}) as never);
			mockVercelGetProjectUrl.mockResolvedValue({
				url: "https://my-project.vercel.app",
				hasAlias: true,
			});
			mockSaveProject.mockResolvedValue(undefined);
			// Decline per-project config, accept doc population
			mockConfirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

			await addCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--path",
				"/tmp/fake",
			]);

			expect(mockExeca).toHaveBeenCalledWith(
				"claude",
				expect.arrayContaining(["-p", "--allowedTools"]),
				expect.objectContaining({ timeout: 600_000 }),
			);
		});

		it("should print manual command when doc population is declined", async () => {
			mockGetProject.mockResolvedValue(undefined);
			mockFs.pathExists.mockImplementation(((p: string) =>
				Promise.resolve(p.endsWith(".git"))) as never);
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
				if (cmd === "gh") {
					if (args?.includes("pr")) {
						return {
							stdout: "https://github.com/o/r/pull/1",
							stderr: "",
						} as never;
					}
					return {
						stdout: JSON.stringify({
							url: "https://github.com/o/r",
							owner: { login: "o" },
							name: "r",
						}),
						stderr: "",
					} as never;
				}
				if (cmd === "vercel" && args?.includes("inspect")) {
					return { stdout: "ID\t\t\t\tprj_1", stderr: "" } as never;
				}
				if (cmd === "npx" || cmd === "git") {
					return { stdout: "", stderr: "" } as never;
				}
				throw new Error("Not found");
			}) as never);
			mockVercelGetProjectUrl.mockResolvedValue({
				url: "https://my-project.vercel.app",
				hasAlias: true,
			});
			mockSaveProject.mockResolvedValue(undefined);
			// Decline per-project config, decline doc population
			mockConfirm.mockResolvedValue(false);

			await addCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--path",
				"/tmp/fake",
			]);

			expect(mockExeca).not.toHaveBeenCalledWith(
				"claude",
				expect.anything(),
				expect.anything(),
			);
			expect(mockLog.info).toHaveBeenCalledWith(
				"To populate docs later, run from the project directory:",
			);
			expect(mockLog.step).toHaveBeenCalledWith(
				expect.stringContaining("claude -p"),
			);
		});
	});

	describe("user cancellation", () => {
		it("should handle user force close gracefully", async () => {
			mockGetProject.mockResolvedValue(undefined);
			mockExeca.mockRejectedValue(new Error("Not found"));
			mockInput.mockRejectedValue(new Error("User force closed the prompt"));

			await expect(
				addCommand.parseAsync(["node", "test", "my-project"]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.info).toHaveBeenCalledWith("Operation cancelled.");
			expect(mockExit).toHaveBeenCalledWith(0);
		});
	});
});
