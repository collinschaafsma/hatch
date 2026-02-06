import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import type { VMRecord, VMStore } from "../types/index.js";

const VM_STORE_PATH = path.join(os.homedir(), ".hatch", "vms.json");

/**
 * Load the VM store from disk
 */
export async function loadVMStore(): Promise<VMStore> {
	if (await fs.pathExists(VM_STORE_PATH)) {
		try {
			const data = await fs.readJson(VM_STORE_PATH);
			// Validate version
			if (data.version === 1 && Array.isArray(data.vms)) {
				return data as VMStore;
			}
		} catch {
			// Corrupted file, return empty store
		}
	}

	return { version: 1, vms: [] };
}

/**
 * Save the VM store to disk
 */
export async function saveVMStore(store: VMStore): Promise<void> {
	await fs.ensureDir(path.dirname(VM_STORE_PATH));
	await fs.writeJson(VM_STORE_PATH, store, { spaces: 2 });
}

/**
 * Add a VM to the store
 */
export async function addVM(vm: VMRecord): Promise<void> {
	const store = await loadVMStore();

	// Remove existing entry with same name if any
	store.vms = store.vms.filter((v) => v.name !== vm.name);

	// Add new entry
	store.vms.push(vm);

	await saveVMStore(store);
}

/**
 * Update a VM in the store
 */
export async function updateVM(
	vmName: string,
	updates: Partial<VMRecord>,
): Promise<void> {
	const store = await loadVMStore();
	const index = store.vms.findIndex((v) => v.name === vmName);

	if (index === -1) {
		throw new Error(`VM not found: ${vmName}`);
	}

	store.vms[index] = { ...store.vms[index], ...updates };
	await saveVMStore(store);
}

/**
 * Remove a VM from the store
 */
export async function removeVM(vmName: string): Promise<void> {
	const store = await loadVMStore();
	store.vms = store.vms.filter((v) => v.name !== vmName);
	await saveVMStore(store);
}

/**
 * Get a VM by name
 */
export async function getVM(vmName: string): Promise<VMRecord | undefined> {
	const store = await loadVMStore();
	return store.vms.find((v) => v.name === vmName);
}

/**
 * List all VMs
 */
export async function listVMs(): Promise<VMRecord[]> {
	const store = await loadVMStore();
	return store.vms;
}

/**
 * Get a VM by project and feature name
 */
export async function getVMByFeature(
	project: string,
	feature: string,
): Promise<VMRecord | undefined> {
	const store = await loadVMStore();
	return store.vms.find((v) => v.project === project && v.feature === feature);
}

/**
 * List all VMs for a specific project
 */
export async function listVMsByProject(project: string): Promise<VMRecord[]> {
	const store = await loadVMStore();
	return store.vms.filter((v) => v.project === project);
}

/**
 * Get active spikes (completed status, ready for iteration)
 */
export async function getActiveSpikes(project?: string): Promise<VMRecord[]> {
	const store = await loadVMStore();
	return store.vms.filter(
		(v) => v.spikeStatus === "completed" && (!project || v.project === project),
	);
}
