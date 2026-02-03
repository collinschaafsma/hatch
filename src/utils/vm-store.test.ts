import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockVMRecord } from "../../__tests__/mocks/stores.js";

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
	addVM,
	getVM,
	getVMByFeature,
	listVMs,
	listVMsByProject,
	loadVMStore,
	removeVM,
	saveVMStore,
	updateVM,
} from "./vm-store.js";

const mockFs = vi.mocked(fs);

describe("vm-store utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("loadVMStore", () => {
		it("should return empty store when file does not exist", async () => {
			mockFs.pathExists.mockResolvedValue(false as never);

			const store = await loadVMStore();

			expect(store).toEqual({ version: 1, vms: [] });
		});

		it("should return valid store data when file exists", async () => {
			const mockStore = {
				version: 1,
				vms: [createMockVMRecord()],
			};
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(mockStore as never);

			const store = await loadVMStore();

			expect(store).toEqual(mockStore);
		});

		it("should return empty store when JSON is corrupted", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockRejectedValue(new Error("Invalid JSON") as never);

			const store = await loadVMStore();

			expect(store).toEqual({ version: 1, vms: [] });
		});

		it("should return empty store when version is invalid", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({ version: 2, vms: [] } as never);

			const store = await loadVMStore();

			expect(store).toEqual({ version: 1, vms: [] });
		});

		it("should return empty store when vms is not an array", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({ version: 1, vms: "invalid" } as never);

			const store = await loadVMStore();

			expect(store).toEqual({ version: 1, vms: [] });
		});
	});

	describe("saveVMStore", () => {
		it("should create directory and write store with formatting", async () => {
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			const store = { version: 1 as const, vms: [] };
			await saveVMStore(store);

			expect(mockFs.ensureDir).toHaveBeenCalled();
			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.stringContaining("vms.json"),
				store,
				{ spaces: 2 },
			);
		});
	});

	describe("addVM", () => {
		it("should add VM to empty store", async () => {
			mockFs.pathExists.mockResolvedValue(false as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			const vm = createMockVMRecord({ name: "new-vm" });
			await addVM(vm);

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					vms: [vm],
				}),
				{ spaces: 2 },
			);
		});

		it("should replace existing VM with same name", async () => {
			const existingVM = createMockVMRecord({ name: "my-vm" });
			const updatedVM = createMockVMRecord({
				name: "my-vm",
				feature: "updated-feature",
			});

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [existingVM],
			} as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await addVM(updatedVM);

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					vms: [updatedVM],
				}),
				{ spaces: 2 },
			);
		});

		it("should preserve other VMs when adding new one", async () => {
			const existingVM = createMockVMRecord({ name: "existing-vm" });
			const newVM = createMockVMRecord({ name: "new-vm" });

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [existingVM],
			} as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await addVM(newVM);

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					vms: [existingVM, newVM],
				}),
				{ spaces: 2 },
			);
		});
	});

	describe("updateVM", () => {
		it("should update VM fields", async () => {
			const vm = createMockVMRecord({ name: "my-vm", feature: "old-feature" });

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [vm],
			} as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await updateVM("my-vm", { feature: "new-feature" });

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					vms: [expect.objectContaining({ feature: "new-feature" })],
				}),
				{ spaces: 2 },
			);
		});

		it("should throw when VM not found", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [createMockVMRecord({ name: "other-vm" })],
			} as never);

			await expect(
				updateVM("non-existent", { feature: "new" }),
			).rejects.toThrow("VM not found: non-existent");
		});

		it("should preserve unchanged fields", async () => {
			const vm = createMockVMRecord({
				name: "my-vm",
				feature: "my-feature",
				project: "my-project",
			});

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [vm],
			} as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await updateVM("my-vm", { spikeStatus: "completed" });

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					vms: [
						expect.objectContaining({
							name: "my-vm",
							feature: "my-feature",
							project: "my-project",
							spikeStatus: "completed",
						}),
					],
				}),
				{ spaces: 2 },
			);
		});
	});

	describe("removeVM", () => {
		it("should remove VM from store", async () => {
			const vm1 = createMockVMRecord({ name: "vm-1" });
			const vm2 = createMockVMRecord({ name: "vm-2" });

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [vm1, vm2],
			} as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await removeVM("vm-1");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					vms: [vm2],
				}),
				{ spaces: 2 },
			);
		});

		it("should handle removing non-existent VM gracefully", async () => {
			const vm = createMockVMRecord({ name: "existing-vm" });

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [vm],
			} as never);
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeJson.mockResolvedValue(undefined as never);

			await removeVM("non-existent");

			expect(mockFs.writeJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					vms: [vm],
				}),
				{ spaces: 2 },
			);
		});
	});

	describe("getVM", () => {
		it("should return VM when found", async () => {
			const vm = createMockVMRecord({ name: "my-vm" });
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [vm],
			} as never);

			const result = await getVM("my-vm");

			expect(result).toEqual(vm);
		});

		it("should return undefined when VM not found", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [createMockVMRecord({ name: "other-vm" })],
			} as never);

			const result = await getVM("not-found");

			expect(result).toBeUndefined();
		});
	});

	describe("listVMs", () => {
		it("should return all VMs", async () => {
			const vms = [
				createMockVMRecord({ name: "vm-1" }),
				createMockVMRecord({ name: "vm-2" }),
			];
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms,
			} as never);

			const result = await listVMs();

			expect(result).toEqual(vms);
		});

		it("should return empty array when no VMs", async () => {
			mockFs.pathExists.mockResolvedValue(false as never);

			const result = await listVMs();

			expect(result).toEqual([]);
		});
	});

	describe("getVMByFeature", () => {
		it("should find VM by project and feature", async () => {
			const vm = createMockVMRecord({
				name: "my-vm",
				project: "my-project",
				feature: "add-auth",
			});
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [vm],
			} as never);

			const result = await getVMByFeature("my-project", "add-auth");

			expect(result).toEqual(vm);
		});

		it("should return undefined when no matching VM", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [
					createMockVMRecord({
						project: "other-project",
						feature: "add-auth",
					}),
				],
			} as never);

			const result = await getVMByFeature("my-project", "add-auth");

			expect(result).toBeUndefined();
		});

		it("should match both project and feature", async () => {
			const vm1 = createMockVMRecord({
				name: "vm-1",
				project: "project-a",
				feature: "feature-x",
			});
			const vm2 = createMockVMRecord({
				name: "vm-2",
				project: "project-b",
				feature: "feature-x",
			});
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [vm1, vm2],
			} as never);

			const result = await getVMByFeature("project-b", "feature-x");

			expect(result).toEqual(vm2);
		});
	});

	describe("listVMsByProject", () => {
		it("should filter VMs by project", async () => {
			const vm1 = createMockVMRecord({ name: "vm-1", project: "project-a" });
			const vm2 = createMockVMRecord({ name: "vm-2", project: "project-b" });
			const vm3 = createMockVMRecord({ name: "vm-3", project: "project-a" });

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [vm1, vm2, vm3],
			} as never);

			const result = await listVMsByProject("project-a");

			expect(result).toEqual([vm1, vm3]);
		});

		it("should return empty array when no VMs for project", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue({
				version: 1,
				vms: [createMockVMRecord({ project: "other-project" })],
			} as never);

			const result = await listVMsByProject("my-project");

			expect(result).toEqual([]);
		});
	});
});
