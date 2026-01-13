import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	execCommand,
	gitAdd,
	gitCommit,
	gitInit,
	npxCommand,
	pnpmAdd,
	pnpmDlx,
	pnpmExec,
	pnpmInstall,
	pnpmRun,
} from "./exec.js";

vi.mock("execa", () => ({
	execa: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
}));

import { execa } from "execa";

const mockExeca = vi.mocked(execa);

describe("exec utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("execCommand", () => {
		it("should execute command with correct arguments", async () => {
			await execCommand("echo", ["hello"]);
			expect(mockExeca).toHaveBeenCalledWith("echo", ["hello"], {
				stdio: "pipe",
			});
		});

		it("should pass options to execa", async () => {
			await execCommand("echo", ["hello"], { cwd: "/tmp" });
			expect(mockExeca).toHaveBeenCalledWith("echo", ["hello"], {
				stdio: "pipe",
				cwd: "/tmp",
			});
		});

		it("should return stdout and stderr", async () => {
			mockExeca.mockResolvedValueOnce({
				stdout: "output",
				stderr: "error",
			} as never);
			const result = await execCommand("echo", ["hello"]);
			expect(result).toEqual({ stdout: "output", stderr: "error" });
		});

		it("should handle non-string outputs", async () => {
			mockExeca.mockResolvedValueOnce({
				stdout: undefined,
				stderr: undefined,
			} as never);
			const result = await execCommand("echo", ["hello"]);
			expect(result).toEqual({ stdout: "", stderr: "" });
		});

		it("should propagate errors", async () => {
			const error = new Error("Command failed");
			mockExeca.mockRejectedValueOnce(error);
			await expect(execCommand("echo", ["hello"])).rejects.toThrow(
				"Command failed",
			);
		});
	});

	describe("pnpmInstall", () => {
		it("should call pnpm install in the specified directory", async () => {
			await pnpmInstall("/project");
			expect(mockExeca).toHaveBeenCalledWith("pnpm", ["install"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});
	});

	describe("pnpmAdd", () => {
		it("should add packages as dependencies", async () => {
			await pnpmAdd(["react", "next"], "/project");
			expect(mockExeca).toHaveBeenCalledWith("pnpm", ["add", "react", "next"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});

		it("should add packages as devDependencies when dev=true", async () => {
			await pnpmAdd(["vitest"], "/project", true);
			expect(mockExeca).toHaveBeenCalledWith("pnpm", ["add", "-D", "vitest"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});

		it("should handle multiple packages", async () => {
			await pnpmAdd(["a", "b", "c"], "/project");
			expect(mockExeca).toHaveBeenCalledWith("pnpm", ["add", "a", "b", "c"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});
	});

	describe("pnpmExec", () => {
		it("should execute command via pnpm exec", async () => {
			await pnpmExec("tsc", ["--noEmit"], "/project");
			expect(mockExeca).toHaveBeenCalledWith(
				"pnpm",
				["exec", "tsc", "--noEmit"],
				{ stdio: "pipe", cwd: "/project" },
			);
		});
	});

	describe("pnpmRun", () => {
		it("should run script via pnpm run", async () => {
			await pnpmRun("build", "/project");
			expect(mockExeca).toHaveBeenCalledWith("pnpm", ["run", "build"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});
	});

	describe("pnpmDlx", () => {
		it("should execute command via pnpm dlx", async () => {
			await pnpmDlx("create-next-app", ["my-app"], "/project");
			expect(mockExeca).toHaveBeenCalledWith(
				"pnpm",
				["dlx", "create-next-app", "my-app"],
				{ stdio: "pipe", cwd: "/project" },
			);
		});

		it("should return stdout and stderr", async () => {
			mockExeca.mockResolvedValueOnce({
				stdout: "created",
				stderr: "",
			} as never);
			const result = await pnpmDlx("create-next-app", ["my-app"], "/project");
			expect(result).toEqual({ stdout: "created", stderr: "" });
		});
	});

	describe("npxCommand", () => {
		it("should execute command via npx", async () => {
			await npxCommand("shadcn-ui", ["init"], "/project");
			expect(mockExeca).toHaveBeenCalledWith("npx", ["shadcn-ui", "init"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});

		it("should return stdout and stderr", async () => {
			mockExeca.mockResolvedValueOnce({
				stdout: "initialized",
				stderr: "",
			} as never);
			const result = await npxCommand("shadcn-ui", ["init"], "/project");
			expect(result).toEqual({ stdout: "initialized", stderr: "" });
		});
	});

	describe("gitInit", () => {
		it("should initialize git repository", async () => {
			await gitInit("/project");
			expect(mockExeca).toHaveBeenCalledWith("git", ["init"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});
	});

	describe("gitAdd", () => {
		it("should add all files by default", async () => {
			await gitAdd("/project");
			expect(mockExeca).toHaveBeenCalledWith("git", ["add", "."], {
				stdio: "pipe",
				cwd: "/project",
			});
		});

		it("should add specific files when specified", async () => {
			await gitAdd("/project", "package.json");
			expect(mockExeca).toHaveBeenCalledWith("git", ["add", "package.json"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});
	});

	describe("gitCommit", () => {
		it("should commit with the specified message", async () => {
			await gitCommit("Initial commit", "/project");
			expect(mockExeca).toHaveBeenCalledWith(
				"git",
				["commit", "-m", "Initial commit"],
				{ stdio: "pipe", cwd: "/project" },
			);
		});
	});
});
