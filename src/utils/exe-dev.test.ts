import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("execa", () => ({
	execa: vi.fn(),
}));

vi.mock("./ssh.js", () => ({
	checkSSHConnection: vi.fn(),
}));

import { execa } from "execa";
import {
	checkExeDevAccess,
	exeDevList,
	exeDevNew,
	exeDevRm,
	exeDevSetPublic,
	exeDevSharePort,
	waitForVMReady,
} from "./exe-dev.js";
import { checkSSHConnection } from "./ssh.js";

const mockExeca = vi.mocked(execa);
const mockCheckSSH = vi.mocked(checkSSHConnection);

describe("exe-dev utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("checkExeDevAccess", () => {
		it("should return available true when SSH works", async () => {
			mockExeca.mockResolvedValue({
				stdout: "exe.dev help output",
				stderr: "",
			} as never);

			const result = await checkExeDevAccess();

			expect(result).toEqual({ available: true });
			expect(mockExeca).toHaveBeenCalledWith(
				"ssh",
				expect.arrayContaining(["exe.dev", "help"]),
				expect.any(Object),
			);
		});

		it("should return available true with empty output", async () => {
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);

			const result = await checkExeDevAccess();

			expect(result).toEqual({ available: true });
		});

		it("should return specific error for permission denied", async () => {
			mockExeca.mockRejectedValue(new Error("Permission denied") as never);

			const result = await checkExeDevAccess();

			expect(result).toEqual({
				available: false,
				error: "SSH key not authorized. Add your SSH public key to exe.dev.",
			});
		});

		it("should return specific error for hostname resolution failure", async () => {
			mockExeca.mockRejectedValue(
				new Error("Could not resolve hostname") as never,
			);

			const result = await checkExeDevAccess();

			expect(result).toEqual({
				available: false,
				error: "Cannot connect to exe.dev. Check your network connection.",
			});
		});

		it("should return specific error for connection refused", async () => {
			mockExeca.mockRejectedValue(new Error("Connection refused") as never);

			const result = await checkExeDevAccess();

			expect(result).toEqual({
				available: false,
				error: "Cannot connect to exe.dev. Check your network connection.",
			});
		});

		it("should return generic error for unknown failures", async () => {
			mockExeca.mockRejectedValue(new Error("Timeout exceeded") as never);

			const result = await checkExeDevAccess();

			expect(result).toEqual({
				available: false,
				error: "SSH connection failed: Timeout exceeded",
			});
		});

		it("should handle non-Error exceptions", async () => {
			mockExeca.mockRejectedValue("string error" as never);

			const result = await checkExeDevAccess();

			expect(result).toEqual({
				available: false,
				error: "SSH connection failed: Unknown SSH error",
			});
		});
	});

	describe("exeDevNew", () => {
		it("should parse JSON response correctly", async () => {
			mockExeca.mockResolvedValue({
				stdout: JSON.stringify({
					vm_name: "fortune-sprite",
					ssh_dest: "fortune-sprite.exe.xyz",
				}),
				stderr: "",
			} as never);

			const result = await exeDevNew();

			expect(result).toEqual({
				name: "fortune-sprite",
				sshHost: "fortune-sprite.exe.xyz",
			});
		});

		it("should use name field if vm_name is missing", async () => {
			mockExeca.mockResolvedValue({
				stdout: JSON.stringify({
					name: "happy-cloud",
					ssh_dest: "happy-cloud.exe.xyz",
				}),
				stderr: "",
			} as never);

			const result = await exeDevNew();

			expect(result).toEqual({
				name: "happy-cloud",
				sshHost: "happy-cloud.exe.xyz",
			});
		});

		it("should construct ssh_dest if missing", async () => {
			mockExeca.mockResolvedValue({
				stdout: JSON.stringify({ vm_name: "test-vm" }),
				stderr: "",
			} as never);

			const result = await exeDevNew();

			expect(result).toEqual({
				name: "test-vm",
				sshHost: "test-vm.exe.xyz",
			});
		});

		it("should extract name from text output when not JSON", async () => {
			mockExeca.mockResolvedValue({
				stdout: 'Created VM: name: "happy-tiger"',
				stderr: "",
			} as never);

			const result = await exeDevNew();

			expect(result).toEqual({
				name: "happy-tiger",
				sshHost: "happy-tiger.exe.xyz",
			});
		});

		it("should throw when VM name cannot be parsed", async () => {
			mockExeca.mockResolvedValue({
				stdout: "Unknown output format",
				stderr: "",
			} as never);

			await expect(exeDevNew()).rejects.toThrow(
				"Failed to parse VM name from exe.dev output",
			);
		});

		it("should throw when JSON missing vm_name", async () => {
			mockExeca.mockResolvedValue({
				stdout: JSON.stringify({ other_field: "value" }),
				stderr: "",
			} as never);

			await expect(exeDevNew()).rejects.toThrow("Failed to parse VM name");
		});

		it("should call exe.dev new with --json flag", async () => {
			mockExeca.mockResolvedValue({
				stdout: JSON.stringify({ vm_name: "test", ssh_dest: "test.exe.xyz" }),
				stderr: "",
			} as never);

			await exeDevNew();

			expect(mockExeca).toHaveBeenCalledWith(
				"ssh",
				expect.arrayContaining(["exe.dev", "new", "--json"]),
				expect.any(Object),
			);
		});
	});

	describe("exeDevList", () => {
		it("should parse VM list output", async () => {
			mockExeca.mockResolvedValue({
				stdout:
					"name           status\nfortune-sprite running\nhappy-cloud    stopped",
				stderr: "",
			} as never);

			const result = await exeDevList();

			expect(result).toEqual([
				{ name: "fortune-sprite", status: "running" },
				{ name: "happy-cloud", status: "stopped" },
			]);
		});

		it("should skip header lines", async () => {
			mockExeca.mockResolvedValue({
				stdout: "name    status\n-----   ------\nmy-vm   running",
				stderr: "",
			} as never);

			const result = await exeDevList();

			expect(result).toEqual([{ name: "my-vm", status: "running" }]);
		});

		it("should handle empty output", async () => {
			mockExeca.mockResolvedValue({
				stdout: "",
				stderr: "",
			} as never);

			const result = await exeDevList();

			expect(result).toEqual([]);
		});

		it("should skip separator lines", async () => {
			mockExeca.mockResolvedValue({
				stdout: "-------\n=======\ntest-vm running",
				stderr: "",
			} as never);

			const result = await exeDevList();

			expect(result).toEqual([{ name: "test-vm", status: "running" }]);
		});

		it("should default status to unknown when missing", async () => {
			mockExeca.mockResolvedValue({
				stdout: "my-vm",
				stderr: "",
			} as never);

			const result = await exeDevList();

			expect(result).toEqual([{ name: "my-vm", status: "unknown" }]);
		});
	});

	describe("exeDevRm", () => {
		it("should call exe.dev rm with VM name", async () => {
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);

			await exeDevRm("fortune-sprite");

			expect(mockExeca).toHaveBeenCalledWith(
				"ssh",
				expect.arrayContaining(["exe.dev", "rm", "fortune-sprite"]),
				expect.any(Object),
			);
		});
	});

	describe("exeDevSharePort", () => {
		it("should call exe.dev share port with VM name and port", async () => {
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);

			await exeDevSharePort("fortune-sprite", 3000);

			expect(mockExeca).toHaveBeenCalledWith(
				"ssh",
				expect.arrayContaining([
					"exe.dev",
					"share",
					"port",
					"fortune-sprite",
					"3000",
				]),
				expect.any(Object),
			);
		});

		it("should convert port number to string", async () => {
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);

			await exeDevSharePort("vm", 8080);

			const call = mockExeca.mock.calls[0];
			expect(call[1]).toContain("8080");
		});
	});

	describe("exeDevSetPublic", () => {
		it("should call exe.dev share set-public with VM name", async () => {
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);

			await exeDevSetPublic("fortune-sprite");

			expect(mockExeca).toHaveBeenCalledWith(
				"ssh",
				expect.arrayContaining([
					"exe.dev",
					"share",
					"set-public",
					"fortune-sprite",
				]),
				expect.any(Object),
			);
		});
	});

	describe("waitForVMReady", () => {
		it("should return immediately when VM is ready", async () => {
			mockCheckSSH.mockResolvedValue(true);

			const promise = waitForVMReady("test.exe.xyz");
			await vi.runAllTimersAsync();
			await promise;

			expect(mockCheckSSH).toHaveBeenCalledWith("test.exe.xyz");
		});

		it("should poll until VM becomes ready", async () => {
			mockCheckSSH
				.mockResolvedValueOnce(false)
				.mockResolvedValueOnce(false)
				.mockResolvedValueOnce(true);

			const promise = waitForVMReady("test.exe.xyz", 120000, 1000);

			// First check - not ready
			await vi.advanceTimersByTimeAsync(0);
			expect(mockCheckSSH).toHaveBeenCalledTimes(1);

			// Wait for first interval
			await vi.advanceTimersByTimeAsync(1000);
			expect(mockCheckSSH).toHaveBeenCalledTimes(2);

			// Wait for second interval - should succeed
			await vi.advanceTimersByTimeAsync(1000);
			expect(mockCheckSSH).toHaveBeenCalledTimes(3);

			await promise;
		});

		it("should throw on timeout", async () => {
			mockCheckSSH.mockResolvedValue(false);

			// Create the promise and immediately set up error handling
			let error: Error | undefined;
			const promise = waitForVMReady("test.exe.xyz", 5000, 1000).catch((e) => {
				error = e;
			});

			// Advance past the timeout
			await vi.advanceTimersByTimeAsync(6000);

			// Wait for the promise to settle
			await promise;

			expect(error).toBeDefined();
			expect(error?.message).toBe(
				"VM test.exe.xyz did not become ready within 5000ms",
			);
		});

		it("should use default timeout of 120 seconds", async () => {
			mockCheckSSH.mockResolvedValue(false);

			// Create the promise and immediately set up error handling
			let error: Error | undefined;
			const promise = waitForVMReady("test.exe.xyz").catch((e) => {
				error = e;
			});

			// Advance past the default timeout
			await vi.advanceTimersByTimeAsync(125000);

			// Wait for the promise to settle
			await promise;

			expect(error).toBeDefined();
			expect(error?.message).toContain("within 120000ms");
		});

		it("should use default interval of 3 seconds", async () => {
			mockCheckSSH.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

			const promise = waitForVMReady("test.exe.xyz");

			// Initial check
			await vi.advanceTimersByTimeAsync(0);
			expect(mockCheckSSH).toHaveBeenCalledTimes(1);

			// Check after default interval (3000ms)
			await vi.advanceTimersByTimeAsync(3000);
			expect(mockCheckSSH).toHaveBeenCalledTimes(2);

			await promise;
		});
	});
});
