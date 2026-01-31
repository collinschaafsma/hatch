import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import type { ProjectRecord, ProjectStore } from "../types/index.js";

const PROJECT_STORE_PATH = path.join(os.homedir(), ".hatch", "projects.json");

/**
 * Load the project store from disk
 */
export async function loadProjectStore(): Promise<ProjectStore> {
	if (await fs.pathExists(PROJECT_STORE_PATH)) {
		try {
			const data = await fs.readJson(PROJECT_STORE_PATH);
			// Validate version
			if (data.version === 1 && Array.isArray(data.projects)) {
				return data as ProjectStore;
			}
		} catch {
			// Corrupted file, return empty store
		}
	}

	return { version: 1, projects: [] };
}

/**
 * Save the project store to disk
 */
export async function saveProjectStore(store: ProjectStore): Promise<void> {
	await fs.ensureDir(path.dirname(PROJECT_STORE_PATH));
	await fs.writeJson(PROJECT_STORE_PATH, store, { spaces: 2 });
}

/**
 * Save a project to the store
 */
export async function saveProject(project: ProjectRecord): Promise<void> {
	const store = await loadProjectStore();

	// Remove existing entry with same name if any
	store.projects = store.projects.filter((p) => p.name !== project.name);

	// Add new entry
	store.projects.push(project);

	await saveProjectStore(store);
}

/**
 * Get a project by name
 */
export async function getProject(
	name: string,
): Promise<ProjectRecord | undefined> {
	const store = await loadProjectStore();
	return store.projects.find((p) => p.name === name);
}

/**
 * List all projects
 */
export async function listProjects(): Promise<ProjectRecord[]> {
	const store = await loadProjectStore();
	return store.projects;
}

/**
 * Delete a project from the store
 */
export async function deleteProject(name: string): Promise<void> {
	const store = await loadProjectStore();
	store.projects = store.projects.filter((p) => p.name !== name);
	await saveProjectStore(store);
}
