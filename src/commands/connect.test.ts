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

vi.mock("@inquirer/prompts", () => ({
	select: vi.fn(),
}));

vi.mock("../utils/project-store.js", () => ({
	getProject: vi.fn(),
}));

vi.mock("../utils/vm-store.js", () => ({
	getVMByFeature: vi.fn(),
	listVMs: vi.fn(),
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

import { select } from "@inquirer/prompts";
import { log } from "../utils/logger.js";
import { getProject } from "../utils/project-store.js";
import { getVMByFeature, listVMs } from "../utils/vm-store.js";
import { connectCommand } from "./connect.js";

const mockSelect = vi.mocked(select);
const mockGetProject = vi.mocked(getProject);
const mockGetVMByFeature = vi.mocked(getVMByFeature);
const mockListVMs = vi.mocked(listVMs);
const mockLog = vi.mocked(log);

describe("connect command", () => {
	let mockExit: MockInstance;

	beforeEach(() => {
		vi.clearAllMocks();
		mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit called");
		});
	});

	afterEach(() => {
		mockExit.mockRestore();
	});

	describe("lookup by feature and project", () => {
		it("should find VM by feature and project", async () => {
			const vm = createMockVMRecord({
				name: "my-vm",
				project: "my-project",
				feature: "add-auth",
			});
			const project = createMockProjectRecord({ name: "my-project" });
			mockGetVMByFeature.mockResolvedValue(vm);
			mockGetProject.mockResolvedValue(project);

			await connectCommand.parseAsync([
				"node",
				"test",
				"add-auth",
				"--project",
				"my-project",
			]);

			expect(mockGetVMByFeature).toHaveBeenCalledWith("my-project", "add-auth");
			expect(mockLog.info).toHaveBeenCalledWith("Feature: add-auth");
			expect(mockLog.step).toHaveBeenCalledWith("VM:         my-vm");
		});

		it("should show error when VM not found by feature and project", async () => {
			mockGetVMByFeature.mockResolvedValue(undefined);

			await expect(
				connectCommand.parseAsync([
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

	describe("interactive selection", () => {
		it("should prompt selection with multiple VMs", async () => {
			const vms = [
				createMockVMRecord({
					name: "vm-1",
					project: "project-a",
					feature: "feat-1",
				}),
				createMockVMRecord({
					name: "vm-2",
					project: "project-b",
					feature: "feat-2",
				}),
			];
			mockListVMs.mockResolvedValue(vms);
			mockSelect.mockResolvedValue("vm-1");
			mockGetProject.mockResolvedValue(
				createMockProjectRecord({ name: "project-a" }),
			);

			await connectCommand.parseAsync(["node", "test"]);

			expect(mockSelect).toHaveBeenCalledWith({
				message: "Select a feature VM:",
				choices: expect.arrayContaining([
					expect.objectContaining({ value: "vm-1" }),
					expect.objectContaining({ value: "vm-2" }),
				]),
			});
		});

		it("should auto-select single VM without prompt", async () => {
			const vm = createMockVMRecord({
				name: "only-vm",
				project: "my-project",
				feature: "only-feature",
			});
			mockListVMs.mockResolvedValue([vm]);
			mockGetProject.mockResolvedValue(
				createMockProjectRecord({ name: "my-project" }),
			);

			await connectCommand.parseAsync(["node", "test"]);

			expect(mockSelect).not.toHaveBeenCalled();
			expect(mockLog.info).toHaveBeenCalledWith("Feature: only-feature");
		});

		it("should show error when no VMs exist", async () => {
			mockListVMs.mockResolvedValue([]);

			await expect(connectCommand.parseAsync(["node", "test"])).rejects.toThrow(
				"process.exit called",
			);

			expect(mockLog.error).toHaveBeenCalledWith("No feature VMs found.");
			expect(mockLog.info).toHaveBeenCalledWith(
				"Run 'hatch feature <name> --project <project>' to create a feature VM.",
			);
		});
	});

	describe("connection info display", () => {
		it("should display SSH connection command", async () => {
			const vm = createMockVMRecord({
				name: "test-vm",
				sshHost: "test-vm.exe.xyz",
				project: "my-project",
				feature: "my-feature",
			});
			mockListVMs.mockResolvedValue([vm]);
			mockGetProject.mockResolvedValue(
				createMockProjectRecord({
					name: "my-project",
					github: {
						url: "https://github.com/test/my-project",
						owner: "test",
						repo: "my-project",
					},
				}),
			);

			await connectCommand.parseAsync(["node", "test"]);

			expect(mockLog.step).toHaveBeenCalledWith("SSH:     ssh test-vm.exe.xyz");
		});

		it("should display VS Code connection URL", async () => {
			const vm = createMockVMRecord({
				name: "test-vm",
				sshHost: "test-vm.exe.xyz",
			});
			const project = createMockProjectRecord({
				name: "my-project",
				github: { url: "", owner: "test", repo: "my-repo" },
			});
			mockListVMs.mockResolvedValue([vm]);
			mockGetProject.mockResolvedValue(project);

			await connectCommand.parseAsync(["node", "test"]);

			expect(mockLog.step).toHaveBeenCalledWith(
				expect.stringContaining("code --remote ssh-remote+test-vm.exe.xyz"),
			);
		});

		it("should display web URL", async () => {
			const vm = createMockVMRecord({ name: "test-vm" });
			mockListVMs.mockResolvedValue([vm]);
			mockGetProject.mockResolvedValue(createMockProjectRecord());

			await connectCommand.parseAsync(["node", "test"]);

			expect(mockLog.step).toHaveBeenCalledWith(
				"Web:     https://test-vm.exe.xyz (once app runs on port 3000)",
			);
		});

		it("should display Convex feature project if present", async () => {
			const vm = createMockVMRecord({
				convexFeatureProject: {
					projectId: "proj_123",
					projectSlug: "test-project-feature-1",
					deploymentName: "cool-penguin-123",
					deploymentUrl: "https://test-project-feature-1.convex.cloud",
					deployKey: "dk_123",
				},
			});
			mockListVMs.mockResolvedValue([vm]);
			mockGetProject.mockResolvedValue(createMockProjectRecord());

			await connectCommand.parseAsync(["node", "test"]);

			expect(mockLog.step).toHaveBeenCalledWith(
				"Convex:     test-project-feature-1",
			);
		});

		it("should display cleanup command", async () => {
			const vm = createMockVMRecord({
				project: "my-project",
				feature: "my-feature",
			});
			mockListVMs.mockResolvedValue([vm]);
			mockGetProject.mockResolvedValue(createMockProjectRecord());

			await connectCommand.parseAsync(["node", "test"]);

			expect(mockLog.step).toHaveBeenCalledWith(
				"hatch clean my-feature --project my-project",
			);
		});
	});

	describe("error handling", () => {
		it("should handle user cancellation gracefully", async () => {
			mockListVMs.mockResolvedValue([
				createMockVMRecord(),
				createMockVMRecord({ name: "vm-2" }),
			]);
			mockSelect.mockRejectedValue(new Error("User force closed the prompt"));

			await expect(connectCommand.parseAsync(["node", "test"])).rejects.toThrow(
				"process.exit called",
			);

			// Exit code 0 for user cancellation
			expect(mockExit).toHaveBeenCalledWith(0);
		});

		it("should handle other errors with exit code 1", async () => {
			mockListVMs.mockRejectedValue(new Error("Database error"));

			await expect(connectCommand.parseAsync(["node", "test"])).rejects.toThrow(
				"process.exit called",
			);

			expect(mockLog.error).toHaveBeenCalledWith(
				"Failed to get VM info: Database error",
			);
			expect(mockExit).toHaveBeenCalledWith(1);
		});
	});
});
