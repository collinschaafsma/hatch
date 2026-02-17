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
	},
}));

vi.mock("execa", () => ({
	execa: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
	input: vi.fn(),
}));

vi.mock("../utils/project-store.js", () => ({
	getProject: vi.fn(),
	saveProject: vi.fn(),
}));

vi.mock("../headless/cli-wrappers.js", () => ({
	vercelGetProjectUrl: vi.fn(),
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

import { input } from "@inquirer/prompts";
import { execa } from "execa";
import fs from "fs-extra";
import { vercelGetProjectUrl } from "../headless/cli-wrappers.js";
import { log } from "../utils/logger.js";
import { getProject, saveProject } from "../utils/project-store.js";
import { addCommand } from "./add.js";

const mockInput = vi.mocked(input);
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

	describe("Convex lookup", () => {
		it("should error when Convex is not provided", async () => {
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
				throw new Error("Not found");
			}) as never);
			mockInput.mockResolvedValue("");

			await expect(
				addCommand.parseAsync(["node", "test", "my-project"]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith("Convex project is required.");
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
			// First input: Convex slug, second: deployment URL, third: deploy key,
			// fourth: deployment name, then Vercel prompts return empty
			mockInput
				.mockResolvedValueOnce("my-slug")
				.mockResolvedValueOnce("https://my-slug.convex.cloud")
				.mockResolvedValueOnce("")
				.mockResolvedValueOnce("")
				.mockResolvedValueOnce("");

			await expect(
				addCommand.parseAsync(["node", "test", "my-project"]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith("Vercel project is required.");
		});

		it("should prompt for Vercel info when not found", async () => {
			mockGetProject.mockResolvedValue(undefined);
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
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
					return { stdout: "other-project", stderr: "" } as never;
				}
				throw new Error("Not found");
			}) as never);
			// Convex slug, deployment URL, deploy key, deployment name, then Vercel project ID, Vercel URL
			mockInput
				.mockResolvedValueOnce("my-slug")
				.mockResolvedValueOnce("https://my-slug.convex.cloud")
				.mockResolvedValueOnce("")
				.mockResolvedValueOnce("")
				.mockResolvedValueOnce("manual_id")
				.mockResolvedValueOnce("https://custom.vercel.app");
			mockSaveProject.mockResolvedValue(undefined);

			await addCommand.parseAsync(["node", "test", "my-project"]);

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
			mockExeca.mockImplementation((async (cmd: string, args?: string[]) => {
				if (cmd === "gh") {
					return {
						stdout: JSON.stringify({
							url: "https://github.com/org/repo",
							owner: { login: "org" },
							name: "repo",
						}),
						stderr: "",
					} as never;
				}
				if (cmd === "vercel" && args?.includes("ls")) {
					return { stdout: "my-project", stderr: "" } as never;
				}
				if (cmd === "vercel" && args?.includes("inspect")) {
					return { stdout: "ID: prj_123", stderr: "" } as never;
				}
				throw new Error("Not found");
			}) as never);
			// Convex slug, deployment URL, deploy key, deployment name prompts
			mockInput
				.mockResolvedValueOnce("my-convex-project")
				.mockResolvedValueOnce("https://my-convex-project.convex.cloud")
				.mockResolvedValueOnce("dk_abc123")
				.mockResolvedValueOnce("my-convex-project");
			mockVercelGetProjectUrl.mockResolvedValue({
				url: "https://my-project.vercel.app",
				hasAlias: true,
			});
			mockSaveProject.mockResolvedValue(undefined);

			await addCommand.parseAsync(["node", "test", "my-project"]);

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
					convex: {
						projectSlug: "my-convex-project",
						deploymentUrl: "https://my-convex-project.convex.cloud",
						deploymentName: "my-convex-project",
						deployKey: "dk_abc123",
					},
				}),
			);
			expect(mockLog.success).toHaveBeenCalledWith(
				"Project added successfully!",
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
