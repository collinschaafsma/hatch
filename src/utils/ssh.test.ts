import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("execa", () => ({
	execa: vi.fn(),
}));

import { execa } from "execa";
import { checkSSHConnection, scpToRemote, sshExec } from "./ssh.js";

const mockExeca = vi.mocked(execa);

describe("ssh utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("sshExec", () => {
		it("should execute command on remote host with correct options", async () => {
			mockExeca.mockResolvedValue({ stdout: "output", stderr: "" } as never);

			const result = await sshExec("test-vm.exe.xyz", "ls -la");

			expect(mockExeca).toHaveBeenCalledWith(
				"ssh",
				[
					"-o",
					"StrictHostKeyChecking=accept-new",
					"-o",
					"ConnectTimeout=10",
					"-o",
					"ServerAliveInterval=30",
					"-o",
					"ServerAliveCountMax=10",
					"test-vm.exe.xyz",
					"ls -la",
				],
				{
					stdio: ["pipe", "pipe", "pipe"],
					timeout: 60000,
				},
			);
			expect(result).toEqual({ stdout: "output", stderr: "" });
		});

		it("should use default timeout of 60000ms", async () => {
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);

			await sshExec("host", "cmd");

			expect(mockExeca).toHaveBeenCalledWith(
				"ssh",
				expect.any(Array),
				expect.objectContaining({ timeout: 60000 }),
			);
		});

		it("should use custom timeout when provided", async () => {
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);

			await sshExec("host", "cmd", { timeoutMs: 120000 });

			expect(mockExeca).toHaveBeenCalledWith(
				"ssh",
				expect.any(Array),
				expect.objectContaining({ timeout: 120000 }),
			);
		});

		it("should use inherit stdio for stderr when streamStderr is true", async () => {
			mockExeca.mockResolvedValue({ stdout: "output", stderr: "" } as never);

			await sshExec("host", "cmd", { streamStderr: true });

			expect(mockExeca).toHaveBeenCalledWith(
				"ssh",
				expect.any(Array),
				expect.objectContaining({
					stdio: ["pipe", "pipe", "inherit"],
				}),
			);
		});

		it("should handle non-string stdout/stderr", async () => {
			mockExeca.mockResolvedValue({
				stdout: undefined,
				stderr: undefined,
			} as never);

			const result = await sshExec("host", "cmd");

			expect(result).toEqual({ stdout: "", stderr: "" });
		});

		it("should return stderr when present", async () => {
			mockExeca.mockResolvedValue({
				stdout: "out",
				stderr: "err",
			} as never);

			const result = await sshExec("host", "cmd");

			expect(result).toEqual({ stdout: "out", stderr: "err" });
		});
	});

	describe("scpToRemote", () => {
		it("should execute scp with correct arguments", async () => {
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);

			await scpToRemote("/local/file.txt", "test-vm.exe.xyz", "/remote/path");

			expect(mockExeca).toHaveBeenCalledWith(
				"scp",
				[
					"-o",
					"StrictHostKeyChecking=accept-new",
					"-o",
					"ConnectTimeout=10",
					"/local/file.txt",
					"test-vm.exe.xyz:/remote/path",
				],
				{
					stdio: "pipe",
				},
			);
		});

		it("should format remote path correctly", async () => {
			mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);

			await scpToRemote("/src", "host.example.com", "/dest");

			const call = mockExeca.mock.calls[0];
			expect(call[1]).toContain("host.example.com:/dest");
		});
	});

	describe("checkSSHConnection", () => {
		it("should return true when SSH connection succeeds", async () => {
			mockExeca.mockResolvedValue({ stdout: "ok", stderr: "" } as never);

			const result = await checkSSHConnection("test-vm.exe.xyz");

			expect(result).toBe(true);
			expect(mockExeca).toHaveBeenCalledWith(
				"ssh",
				[
					"-o",
					"StrictHostKeyChecking=accept-new",
					"-o",
					"ConnectTimeout=5",
					"-o",
					"BatchMode=yes",
					"test-vm.exe.xyz",
					"echo ok",
				],
				{
					stdio: "pipe",
				},
			);
		});

		it("should return false when SSH connection fails", async () => {
			mockExeca.mockRejectedValue(new Error("Connection refused") as never);

			const result = await checkSSHConnection("unreachable.host");

			expect(result).toBe(false);
		});

		it("should use BatchMode=yes for non-interactive check", async () => {
			mockExeca.mockResolvedValue({ stdout: "ok", stderr: "" } as never);

			await checkSSHConnection("host");

			const call = mockExeca.mock.calls[0];
			expect(call[1]).toContain("BatchMode=yes");
		});

		it("should use short ConnectTimeout of 5 seconds", async () => {
			mockExeca.mockResolvedValue({ stdout: "ok", stderr: "" } as never);

			await checkSSHConnection("host");

			const call = mockExeca.mock.calls[0];
			const timeoutIndex = call[1].indexOf("ConnectTimeout=5");
			expect(timeoutIndex).toBeGreaterThan(-1);
		});
	});
});
