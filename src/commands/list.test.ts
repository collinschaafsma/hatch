import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createMockProjectRecord,
	createMockVMRecord,
} from "../__tests__/mocks/stores.js";

vi.mock("../utils/project-store.js", () => ({
	listProjects: vi.fn(),
}));

vi.mock("../utils/vm-store.js", () => ({
	listVMs: vi.fn(),
	listVMsByProject: vi.fn(),
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

import { listProjects } from "../utils/project-store.js";
import { listVMs } from "../utils/vm-store.js";
import { listCommand } from "./list.js";

const mockListProjects = vi.mocked(listProjects);
const mockListVMs = vi.mocked(listVMs);

describe("list command", () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	describe("--json option", () => {
		it("should output projects and VMs as JSON", async () => {
			const projects = [createMockProjectRecord({ name: "my-project" })];
			const vms = [
				createMockVMRecord({ name: "my-vm", project: "my-project" }),
			];
			mockListProjects.mockResolvedValue(projects);
			mockListVMs.mockResolvedValue(vms);

			await listCommand.parseAsync(["node", "test", "--json"]);

			expect(consoleSpy).toHaveBeenCalledWith(
				JSON.stringify({ projects, vms }, null, 2),
			);
		});

		it("should output only projects as JSON with --projects flag", async () => {
			const projects = [createMockProjectRecord({ name: "my-project" })];
			mockListProjects.mockResolvedValue(projects);
			mockListVMs.mockResolvedValue([]);

			await listCommand.parseAsync(["node", "test", "--json", "--projects"]);

			expect(consoleSpy).toHaveBeenCalledWith(
				JSON.stringify(projects, null, 2),
			);
		});
	});

	describe("data retrieval", () => {
		it("should call listProjects", async () => {
			mockListProjects.mockResolvedValue([]);
			mockListVMs.mockResolvedValue([]);

			await listCommand.parseAsync(["node", "test", "--json"]);

			expect(mockListProjects).toHaveBeenCalled();
		});

		it("should call listVMs", async () => {
			mockListProjects.mockResolvedValue([]);
			mockListVMs.mockResolvedValue([]);

			await listCommand.parseAsync(["node", "test", "--json"]);

			expect(mockListVMs).toHaveBeenCalled();
		});
	});
});
