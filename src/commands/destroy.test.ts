import {
	type MockInstance,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	createMockProjectRecord,
	createMockVMRecord,
} from "../__tests__/mocks/stores.js";

vi.mock("fs-extra", () => ({
	default: {
		pathExists: vi.fn(),
		readJson: vi.fn(),
	},
}));

vi.mock("execa", () => ({
	execa: vi.fn(),
}));

vi.mock("../utils/confirmation.js", () => ({
	requireConfirmation: vi.fn(),
}));

vi.mock("../utils/project-store.js", () => ({
	getProject: vi.fn(),
	deleteProject: vi.fn(),
}));

vi.mock("../utils/vm-store.js", () => ({
	listVMsByProject: vi.fn(),
}));

vi.mock("../headless/convex.js", () => ({
	deleteConvexProjectBySlug: vi.fn(),
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

import { execa } from "execa";
import fs from "fs-extra";
import { deleteConvexProjectBySlug } from "../headless/convex.js";
import { requireConfirmation } from "../utils/confirmation.js";
import { log } from "../utils/logger.js";
import { deleteProject, getProject } from "../utils/project-store.js";
import { listVMsByProject } from "../utils/vm-store.js";
import { destroyCommand } from "./destroy.js";

const mockRequireConfirmation = vi.mocked(requireConfirmation);
const mockExeca = vi.mocked(execa);
const mockFs = vi.mocked(fs);
const mockGetProject = vi.mocked(getProject);
const mockDeleteProject = vi.mocked(deleteProject);
const mockDeleteConvexProjectBySlug = vi.mocked(deleteConvexProjectBySlug);
const mockListVMsByProject = vi.mocked(listVMsByProject);
const mockLog = vi.mocked(log);

describe("destroy command", () => {
	let mockExit: MockInstance;

	beforeEach(() => {
		vi.clearAllMocks();
		mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit called");
		});
		mockFs.pathExists.mockResolvedValue(true as never);
		mockFs.readJson.mockResolvedValue({
			convex: { accessToken: "convex_token" },
			vercel: { team: "my-team" },
		} as never);
		mockRequireConfirmation.mockResolvedValue({});
	});

	afterEach(() => {
		mockExit.mockRestore();
	});

	describe("pre-flight checks", () => {
		it("should error when project not found", async () => {
			mockGetProject.mockResolvedValue(undefined);

			await expect(
				destroyCommand.parseAsync(["node", "test", "missing-project"]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith(
				"Project not found: missing-project",
			);
		});

		it("should block when VMs exist", async () => {
			mockGetProject.mockResolvedValue(createMockProjectRecord());
			mockListVMsByProject.mockResolvedValue([
				createMockVMRecord({ feature: "feature-1" }),
				createMockVMRecord({ feature: "feature-2", name: "vm-2" }),
			]);

			await expect(
				destroyCommand.parseAsync(["node", "test", "my-project"]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith(
				"Project has 2 active feature VM(s). Clean them first:",
			);
			expect(mockLog.step).toHaveBeenCalledWith(
				"hatch clean feature-1 --project my-project",
			);
			expect(mockLog.step).toHaveBeenCalledWith(
				"hatch clean feature-2 --project my-project",
			);
		});
	});

	describe("confirmation gate", () => {
		it("should call requireConfirmation with correct args", async () => {
			mockGetProject.mockResolvedValue(
				createMockProjectRecord({ name: "my-project" }),
			);
			mockListVMsByProject.mockResolvedValue([]);
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
			mockDeleteProject.mockResolvedValue(undefined);

			await destroyCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--force",
			]);

			expect(mockRequireConfirmation).toHaveBeenCalledWith(
				expect.objectContaining({
					command: "destroy my-project",
					force: true,
				}),
			);
		});

		it("should abort when requireConfirmation rejects", async () => {
			mockGetProject.mockResolvedValue(createMockProjectRecord());
			mockListVMsByProject.mockResolvedValue([]);
			mockRequireConfirmation.mockRejectedValue(
				new Error("process.exit called"),
			);

			await expect(
				destroyCommand.parseAsync(["node", "test", "my-project"]),
			).rejects.toThrow("process.exit called");
		});
	});

	describe("deletion operations with --force", () => {
		beforeEach(() => {
			mockGetProject.mockResolvedValue(
				createMockProjectRecord({
					name: "my-project",
					convex: {
						projectSlug: "my-project",
						deploymentUrl: "https://my-project.convex.cloud",
						deployKey: "dk_123",
						deploymentName: "cool-penguin-123",
					},
					vercel: { projectId: "prj_123", url: "https://x.vercel.app" },
					github: {
						url: "https://github.com/owner/repo",
						owner: "owner",
						repo: "repo",
					},
				}),
			);
			mockListVMsByProject.mockResolvedValue([]);
		});

		it("should delete Convex project with --force", async () => {
			mockDeleteConvexProjectBySlug.mockResolvedValue(undefined as never);
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
			mockDeleteProject.mockResolvedValue(undefined);

			await destroyCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--force",
			]);

			expect(mockDeleteConvexProjectBySlug).toHaveBeenCalledWith(
				"my-project",
				"convex_token",
			);
		});

		it("should delete Vercel project with --force", async () => {
			mockDeleteConvexProjectBySlug.mockResolvedValue(undefined as never);
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
			mockDeleteProject.mockResolvedValue(undefined);

			await destroyCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--force",
			]);

			expect(mockExeca).toHaveBeenCalledWith(
				"vercel",
				expect.arrayContaining(["project", "rm", "prj_123"]),
				expect.any(Object),
			);
		});

		it("should include team scope for Vercel deletion with --force", async () => {
			mockFs.readJson.mockResolvedValue({
				convex: { accessToken: "convex_token" },
				vercel: { team: "my-team" },
			} as never);
			mockDeleteConvexProjectBySlug.mockResolvedValue(undefined as never);
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
			mockDeleteProject.mockResolvedValue(undefined);

			await destroyCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--force",
			]);

			expect(mockExeca).toHaveBeenCalledWith(
				"vercel",
				expect.arrayContaining(["--scope", "my-team"]),
				expect.any(Object),
			);
		});

		it("should remove from local store with --force", async () => {
			mockDeleteConvexProjectBySlug.mockResolvedValue(undefined as never);
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
			mockDeleteProject.mockResolvedValue(undefined);

			await destroyCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--force",
			]);

			expect(mockDeleteProject).toHaveBeenCalledWith("my-project");
		});

		it("should show GitHub preservation reminder with --force", async () => {
			mockDeleteConvexProjectBySlug.mockResolvedValue(undefined as never);
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
			mockDeleteProject.mockResolvedValue(undefined);

			await destroyCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--force",
			]);

			expect(mockLog.info).toHaveBeenCalledWith(
				"GitHub repository preserved (delete manually if needed):",
			);
			expect(mockLog.step).toHaveBeenCalledWith(
				"gh repo delete owner/repo --yes",
			);
		});

		it("should report full success when all deletions succeed with --force", async () => {
			mockDeleteConvexProjectBySlug.mockResolvedValue(undefined as never);
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
			mockDeleteProject.mockResolvedValue(undefined);

			await destroyCommand.parseAsync([
				"node",
				"test",
				"my-project",
				"--force",
			]);

			expect(mockLog.success).toHaveBeenCalledWith(
				'Project "my-project" destroyed.',
			);
		});
	});

	describe("partial failure handling", () => {
		beforeEach(() => {
			mockGetProject.mockResolvedValue(createMockProjectRecord());
			mockListVMsByProject.mockResolvedValue([]);
		});

		it("should show manual cleanup for Convex failure", async () => {
			mockDeleteConvexProjectBySlug.mockRejectedValue(
				new Error("API error") as never,
			);
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
			mockDeleteProject.mockResolvedValue(undefined);

			await destroyCommand.parseAsync([
				"node",
				"test",
				"test-project",
				"--force",
			]);

			expect(mockLog.warn).toHaveBeenCalledWith(
				expect.stringContaining("partially destroyed"),
			);
			expect(mockLog.error).toHaveBeenCalledWith("Convex project:");
		});

		it("should show manual cleanup for Vercel failure", async () => {
			mockDeleteConvexProjectBySlug.mockResolvedValue(undefined as never);
			mockExeca.mockImplementation((async (cmd: string) => {
				if (cmd === "vercel") {
					throw new Error("Not authorized");
				}
				return { stdout: "", stderr: "" } as never;
			}) as never);
			mockDeleteProject.mockResolvedValue(undefined);

			await destroyCommand.parseAsync([
				"node",
				"test",
				"test-project",
				"--force",
			]);

			expect(mockLog.error).toHaveBeenCalledWith("Vercel project:");
		});

		it("should show manual cleanup for local store failure", async () => {
			mockDeleteConvexProjectBySlug.mockResolvedValue(undefined as never);
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
			mockDeleteProject.mockRejectedValue(new Error("Write error"));

			await destroyCommand.parseAsync([
				"node",
				"test",
				"test-project",
				"--force",
			]);

			expect(mockLog.error).toHaveBeenCalledWith("Local tracking:");
		});
	});
});
