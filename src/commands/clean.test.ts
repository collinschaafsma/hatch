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

vi.mock("@inquirer/prompts", () => ({
	confirm: vi.fn(),
}));

vi.mock("../utils/project-store.js", () => ({
	getProject: vi.fn(),
}));

vi.mock("../utils/vm-store.js", () => ({
	getVMByFeature: vi.fn(),
	removeVM: vi.fn(),
}));

vi.mock("../utils/exe-dev.js", () => ({
	exeDevRm: vi.fn(),
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

import { confirm } from "@inquirer/prompts";
import { execa } from "execa";
import fs from "fs-extra";
import { exeDevRm } from "../utils/exe-dev.js";
import { log } from "../utils/logger.js";
import { getProject } from "../utils/project-store.js";
import { getVMByFeature, removeVM } from "../utils/vm-store.js";
import { cleanCommand } from "./clean.js";

const mockConfirm = vi.mocked(confirm);
const mockExeca = vi.mocked(execa);
const mockFs = vi.mocked(fs);
const mockGetProject = vi.mocked(getProject);
const mockGetVMByFeature = vi.mocked(getVMByFeature);
const mockRemoveVM = vi.mocked(removeVM);
const mockExeDevRm = vi.mocked(exeDevRm);
const mockLog = vi.mocked(log);

describe("clean command", () => {
	let mockExit: MockInstance;

	beforeEach(() => {
		vi.clearAllMocks();
		mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit called");
		});
		mockFs.pathExists.mockResolvedValue(true as never);
		mockFs.readJson.mockResolvedValue({
			supabase: { token: "sb_token" },
			github: { token: "gh_token" },
		} as never);
	});

	afterEach(() => {
		mockExit.mockRestore();
	});

	describe("pre-flight checks", () => {
		it("should error when project not found", async () => {
			mockGetProject.mockResolvedValue(undefined);

			await expect(
				cleanCommand.parseAsync([
					"node",
					"test",
					"my-feature",
					"--project",
					"missing-project",
				]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith(
				"Project not found: missing-project",
			);
			expect(mockLog.info).toHaveBeenCalledWith(
				"Run 'hatch list --projects' to see available projects.",
			);
		});

		it("should error when VM not found", async () => {
			mockGetProject.mockResolvedValue(createMockProjectRecord());
			mockGetVMByFeature.mockResolvedValue(undefined);

			await expect(
				cleanCommand.parseAsync([
					"node",
					"test",
					"missing-feature",
					"--project",
					"my-project",
				]),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith(
				"Feature VM not found: missing-feature (project: my-project)",
			);
		});
	});

	describe("cleanup with --force", () => {
		it("should skip confirmation with --force flag", async () => {
			const project = createMockProjectRecord();
			const vm = createMockVMRecord({
				supabaseBranches: [],
				githubBranch: "",
			});
			mockGetProject.mockResolvedValue(project);
			mockGetVMByFeature.mockResolvedValue(vm);
			mockExeDevRm.mockResolvedValue(undefined);
			mockRemoveVM.mockResolvedValue(undefined);

			await cleanCommand.parseAsync([
				"node",
				"test",
				"my-feature",
				"--project",
				"my-project",
				"--force",
			]);

			expect(mockConfirm).not.toHaveBeenCalled();
			expect(mockLog.success).toHaveBeenCalledWith("Feature cleanup complete!");
		});

		it("should delete Supabase branches with --force", async () => {
			const project = createMockProjectRecord({
				supabase: { projectRef: "sb_ref", region: "us-east-1" },
			});
			const vm = createMockVMRecord({
				supabaseBranches: ["feat-1", "feat-1-test"],
				githubBranch: "",
			});
			mockGetProject.mockResolvedValue(project);
			mockGetVMByFeature.mockResolvedValue(vm);
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
			mockExeDevRm.mockResolvedValue(undefined);
			mockRemoveVM.mockResolvedValue(undefined);

			await cleanCommand.parseAsync([
				"node",
				"test",
				"my-feature",
				"--project",
				"my-project",
				"--force",
			]);

			// Should update then delete each branch
			expect(mockExeca).toHaveBeenCalledWith(
				"supabase",
				expect.arrayContaining(["branches", "update", "feat-1"]),
				expect.any(Object),
			);
			expect(mockExeca).toHaveBeenCalledWith(
				"supabase",
				expect.arrayContaining(["branches", "delete", "feat-1"]),
				expect.any(Object),
			);
		});

		it("should delete git branch via GitHub API with --force", async () => {
			const project = createMockProjectRecord({
				github: {
					url: "https://github.com/owner/repo",
					owner: "owner",
					repo: "repo",
				},
			});
			const vm = createMockVMRecord({
				supabaseBranches: [],
				githubBranch: "feat-branch",
			});
			mockGetProject.mockResolvedValue(project);
			mockGetVMByFeature.mockResolvedValue(vm);
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
			mockExeDevRm.mockResolvedValue(undefined);
			mockRemoveVM.mockResolvedValue(undefined);

			await cleanCommand.parseAsync([
				"node",
				"test",
				"my-feature",
				"--project",
				"my-project",
				"--force",
			]);

			expect(mockExeca).toHaveBeenCalledWith(
				"gh",
				["api", "-X", "DELETE", "/repos/owner/repo/git/refs/heads/feat-branch"],
				expect.any(Object),
			);
		});

		it("should delete VM from exe.dev with --force", async () => {
			const project = createMockProjectRecord();
			const vm = createMockVMRecord({
				name: "fortune-sprite",
				supabaseBranches: [],
				githubBranch: "",
			});
			mockGetProject.mockResolvedValue(project);
			mockGetVMByFeature.mockResolvedValue(vm);
			mockExeDevRm.mockResolvedValue(undefined);
			mockRemoveVM.mockResolvedValue(undefined);

			await cleanCommand.parseAsync([
				"node",
				"test",
				"my-feature",
				"--project",
				"my-project",
				"--force",
			]);

			expect(mockExeDevRm).toHaveBeenCalledWith("fortune-sprite");
		});

		it("should remove VM from local store with --force", async () => {
			const project = createMockProjectRecord();
			const vm = createMockVMRecord({
				name: "my-vm",
				supabaseBranches: [],
				githubBranch: "",
			});
			mockGetProject.mockResolvedValue(project);
			mockGetVMByFeature.mockResolvedValue(vm);
			mockExeDevRm.mockResolvedValue(undefined);
			mockRemoveVM.mockResolvedValue(undefined);

			await cleanCommand.parseAsync([
				"node",
				"test",
				"my-feature",
				"--project",
				"my-project",
				"--force",
			]);

			expect(mockRemoveVM).toHaveBeenCalledWith("my-vm");
		});
	});

	describe("partial failure handling", () => {
		it("should continue when Supabase branch deletion fails", async () => {
			const project = createMockProjectRecord();
			const vm = createMockVMRecord({
				supabaseBranches: ["failing-branch"],
				githubBranch: "",
			});
			mockGetProject.mockResolvedValue(project);
			mockGetVMByFeature.mockResolvedValue(vm);
			mockExeca.mockRejectedValue(new Error("Branch not found"));
			mockExeDevRm.mockResolvedValue(undefined);
			mockRemoveVM.mockResolvedValue(undefined);

			await cleanCommand.parseAsync([
				"node",
				"test",
				"my-feature",
				"--project",
				"my-project",
				"--force",
			]);

			// Should still complete despite branch deletion failure
			expect(mockLog.success).toHaveBeenCalledWith("Feature cleanup complete!");
		});

		it("should warn when VM deletion fails", async () => {
			const project = createMockProjectRecord();
			const vm = createMockVMRecord({
				name: "my-vm",
				supabaseBranches: [],
				githubBranch: "",
			});
			mockGetProject.mockResolvedValue(project);
			mockGetVMByFeature.mockResolvedValue(vm);
			mockExeDevRm.mockRejectedValue(new Error("VM not found"));
			mockRemoveVM.mockResolvedValue(undefined);

			await cleanCommand.parseAsync([
				"node",
				"test",
				"my-feature",
				"--project",
				"my-project",
				"--force",
			]);

			expect(mockLog.warn).toHaveBeenCalledWith(
				"You may need to delete manually: ssh exe.dev rm my-vm",
			);
		});
	});
});
