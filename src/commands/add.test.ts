import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProjectRecord } from "../../__tests__/mocks/stores.js";

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
import { getProject, saveProject } from "../utils/project-store.js";
import { vercelGetProjectUrl } from "../headless/cli-wrappers.js";
import { log } from "../utils/logger.js";
import { addCommand } from "./add.js";

const mockInput = vi.mocked(input);
const mockExeca = vi.mocked(execa);
const mockFs = vi.mocked(fs);
const mockGetProject = vi.mocked(getProject);
const mockSaveProject = vi.mocked(saveProject);
const mockVercelGetProjectUrl = vi.mocked(vercelGetProjectUrl);
const mockLog = vi.mocked(log);

describe("add command", () => {
	let mockExit: ReturnType<typeof vi.spyOn>;

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

	describe("Supabase lookup", () => {
		it("should error when Supabase is not provided", async () => {
			mockGetProject.mockResolvedValue(undefined);
			mockExeca.mockImplementation(async (cmd) => {
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
				if (cmd === "supabase") {
					return { stdout: "[]", stderr: "" } as never;
				}
				throw new Error("Not found");
			});
			mockInput.mockResolvedValue("");

			await expect(
				addCommand.parseAsync(["node", "test", "my-project"]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith(
				"Supabase project is required.",
			);
		});
	});

	describe("Vercel lookup", () => {
		it("should error when Vercel is not provided", async () => {
			mockGetProject.mockResolvedValue(undefined);
			mockExeca.mockImplementation(async (cmd) => {
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
				if (cmd === "supabase") {
					return {
						stdout: JSON.stringify([
							{ id: "sb", name: "my-project", region: "us-east-1" },
						]),
						stderr: "",
					} as never;
				}
				if (cmd === "vercel") {
					return { stdout: "", stderr: "" } as never;
				}
				throw new Error("Not found");
			});
			mockInput.mockResolvedValue("");

			await expect(
				addCommand.parseAsync(["node", "test", "my-project"]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith("Vercel project is required.");
		});

		it("should prompt for Vercel info when not found", async () => {
			mockGetProject.mockResolvedValue(undefined);
			mockExeca.mockImplementation(async (cmd, args) => {
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
				if (cmd === "supabase") {
					return {
						stdout: JSON.stringify([
							{ id: "sb", name: "my-project", region: "us-east-1" },
						]),
						stderr: "",
					} as never;
				}
				if (cmd === "vercel") {
					return { stdout: "other-project", stderr: "" } as never;
				}
				throw new Error("Not found");
			});
			mockInput
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
			mockExeca.mockImplementation(async (cmd, args) => {
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
				if (cmd === "supabase") {
					return {
						stdout: JSON.stringify([
							{ id: "sb_ref", name: "my-project", region: "us-west-2" },
						]),
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
			});
			mockVercelGetProjectUrl.mockResolvedValue({
				url: "https://my-project.vercel.app",
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
					supabase: {
						projectRef: "sb_ref",
						region: "us-west-2",
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
