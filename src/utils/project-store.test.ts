import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProjectRecord } from "../__tests__/mocks/stores.js";

vi.mock("fs-extra", () => ({
	default: {
		pathExists: vi.fn(),
		readJson: vi.fn(),
		writeJson: vi.fn(),
		ensureDir: vi.fn(),
	},
}));

import fs from "fs-extra";
import {
	deleteProject,
	getProject,
	listProjects,
	loadProjectStore,
	saveProject,
	saveProjectStore,
} from "./project-store.js";

const mockFs = vi.mocked(fs);

describe("project-store utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("loadProjectStore", () => {
		it("should return empty store when file does not exist", async () => {
			mockFs.pathExists.mockResolvedValue(false as never);

			const store = await loadProjectStore();

			expect(store).toEqual({ version: 1, projects: [] });
		});

		it("should return valid store data when file exists", async () => {
			const mockStore = {
				version: 1,
				projects: [createMockProjectRecord()],
			};
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(mockStore as never);

			const store = await loadProjectStore();

			expect(store).toEqual(mockStore);
		});

		it("should return empty store when JSON is corrupted", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockRejectedValue(new Error("Invalid JSON") as never);

			const store = await loadProjectStore();

			expect(store).toEqual({ version: 1, projects: [] });
		});

		it("should return empty store when version is invalid", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({ version: 2, projects: [] } as never);

			const store = await loadProjectStore();

			expect(store).toEqual({ version: 1, projects: [] });
		});

		it("should return empty store when projects is not an array", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				projects: "invalid",
			} as never);

			const store = await loadProjectStore();

			expect(store).toEqual({ version: 1, projects: [] });
		});
	});

	describe("saveProjectStore", () => {
		it("should create directory and write store with formatting", async () => {
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			const store = { version: 1 as const, projects: [] };
			await saveProjectStore(store);

			expect(mockFs.ensureDir).toHaveBeenCalled();
			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.stringContaining("projects.json"),
				store,
				{ spaces: 2 },
			);
		});
	});

	describe("saveProject", () => {
		it("should add project to empty store", async () => {
			mockFs.pathExists.mockResolvedValue(false as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			const project = createMockProjectRecord({ name: "new-project" });
			await saveProject(project);

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					projects: [project],
				}),
				{ spaces: 2 },
			);
		});

		it("should replace existing project with same name", async () => {
			const existingProject = createMockProjectRecord({ name: "my-project" });
			const updatedProject = createMockProjectRecord({
				name: "my-project",
				github: {
					url: "https://github.com/new/my-project",
					owner: "new",
					repo: "my-project",
				},
			});

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				projects: [existingProject],
			} as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await saveProject(updatedProject);

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					projects: [updatedProject],
				}),
				{ spaces: 2 },
			);
		});

		it("should preserve other projects when adding new one", async () => {
			const existingProject = createMockProjectRecord({
				name: "existing-project",
			});
			const newProject = createMockProjectRecord({ name: "new-project" });

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				projects: [existingProject],
			} as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await saveProject(newProject);

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					projects: [existingProject, newProject],
				}),
				{ spaces: 2 },
			);
		});
	});

	describe("getProject", () => {
		it("should return project when found", async () => {
			const project = createMockProjectRecord({ name: "my-project" });
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				projects: [project],
			} as never);

			const result = await getProject("my-project");

			expect(result).toEqual(project);
		});

		it("should return undefined when project not found", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				projects: [createMockProjectRecord({ name: "other-project" })],
			} as never);

			const result = await getProject("not-found");

			expect(result).toBeUndefined();
		});

		it("should return undefined when store is empty", async () => {
			mockFs.pathExists.mockResolvedValue(false as never);

			const result = await getProject("any-project");

			expect(result).toBeUndefined();
		});
	});

	describe("listProjects", () => {
		it("should return all projects", async () => {
			const projects = [
				createMockProjectRecord({ name: "project-1" }),
				createMockProjectRecord({ name: "project-2" }),
			];
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				projects,
			} as never);

			const result = await listProjects();

			expect(result).toEqual(projects);
		});

		it("should return empty array when no projects", async () => {
			mockFs.pathExists.mockResolvedValue(false as never);

			const result = await listProjects();

			expect(result).toEqual([]);
		});
	});

	describe("deleteProject", () => {
		it("should remove project from store", async () => {
			const project1 = createMockProjectRecord({ name: "project-1" });
			const project2 = createMockProjectRecord({ name: "project-2" });

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				projects: [project1, project2],
			} as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await deleteProject("project-1");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					projects: [project2],
				}),
				{ spaces: 2 },
			);
		});

		it("should preserve other projects when deleting", async () => {
			const project1 = createMockProjectRecord({ name: "project-1" });
			const project2 = createMockProjectRecord({ name: "project-2" });
			const project3 = createMockProjectRecord({ name: "project-3" });

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				projects: [project1, project2, project3],
			} as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await deleteProject("project-2");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					projects: [project1, project3],
				}),
				{ spaces: 2 },
			);
		});

		it("should handle deleting non-existent project gracefully", async () => {
			const project = createMockProjectRecord({ name: "existing" });

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				projects: [project],
			} as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await deleteProject("non-existent");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					projects: [project],
				}),
				{ spaces: 2 },
			);
		});
	});
});
