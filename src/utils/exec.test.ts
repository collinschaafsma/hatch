import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("execa", () => ({
	execa: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
}));

import { execa } from "execa";
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

const mockExeca = vi.mocked(execa);

describe("exec utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);
	});

	describe("execCommand", () => {
		it("should execute command with args", async () => {
			await execCommand("echo", ["hello", "world"]);

			expect(mockExeca).toHaveBeenCalledWith("echo", ["hello", "world"], {
				stdio: "pipe",
			});
		});

		it("should merge custom options", async () => {
			await execCommand("npm", ["install"], { cwd: "/project" });

			expect(mockExeca).toHaveBeenCalledWith("npm", ["install"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});

		it("should return stdout and stderr", async () => {
			mockExeca.mockResolvedValue({
				stdout: "output",
				stderr: "error",
			} as never);

			const result = await execCommand("cmd", []);

			expect(result).toEqual({ stdout: "output", stderr: "error" });
		});

		it("should handle non-string stdout/stderr", async () => {
			mockExeca.mockResolvedValue({
				stdout: undefined,
				stderr: undefined,
			} as never);

			const result = await execCommand("cmd", []);

			expect(result).toEqual({ stdout: "", stderr: "" });
		});
	});

	describe("pnpmInstall", () => {
		it("should run pnpm install in specified directory", async () => {
			await pnpmInstall("/project");

			expect(mockExeca).toHaveBeenCalledWith("pnpm", ["install"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});
	});

	describe("pnpmAdd", () => {
		it("should add packages as regular dependencies", async () => {
			await pnpmAdd(["react", "react-dom"], "/project");

			expect(mockExeca).toHaveBeenCalledWith(
				"pnpm",
				["add", "react", "react-dom"],
				{
					stdio: "pipe",
					cwd: "/project",
				},
			);
		});

		it("should add packages as dev dependencies", async () => {
			await pnpmAdd(["vitest", "typescript"], "/project", true);

			expect(mockExeca).toHaveBeenCalledWith(
				"pnpm",
				["add", "-D", "vitest", "typescript"],
				{
					stdio: "pipe",
					cwd: "/project",
				},
			);
		});

		it("should default to non-dev dependencies", async () => {
			await pnpmAdd(["lodash"], "/project");

			const call = mockExeca.mock.calls[0];
			expect(call[1]).not.toContain("-D");
		});
	});

	describe("pnpmExec", () => {
		it("should run pnpm exec with command and args", async () => {
			await pnpmExec("biome", ["check", "."], "/project");

			expect(mockExeca).toHaveBeenCalledWith(
				"pnpm",
				["exec", "biome", "check", "."],
				{
					stdio: "pipe",
					cwd: "/project",
				},
			);
		});
	});

	describe("pnpmRun", () => {
		it("should run pnpm script", async () => {
			await pnpmRun("build", "/project");

			expect(mockExeca).toHaveBeenCalledWith("pnpm", ["run", "build"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});
	});

	describe("pnpmDlx", () => {
		it("should run pnpm dlx command", async () => {
			mockExeca.mockResolvedValue({
				stdout: "output",
				stderr: "",
			} as never);

			const result = await pnpmDlx("create-turbo", ["my-app"], "/dir");

			expect(mockExeca).toHaveBeenCalledWith(
				"pnpm",
				["dlx", "create-turbo", "my-app"],
				{
					stdio: "pipe",
					cwd: "/dir",
				},
			);
			expect(result.stdout).toBe("output");
		});
	});

	describe("npxCommand", () => {
		it("should run npx command", async () => {
			mockExeca.mockResolvedValue({
				stdout: "result",
				stderr: "",
			} as never);

			const result = await npxCommand("shadcn-ui", ["add", "button"], "/dir");

			expect(mockExeca).toHaveBeenCalledWith(
				"npx",
				["shadcn-ui", "add", "button"],
				{
					stdio: "pipe",
					cwd: "/dir",
				},
			);
			expect(result.stdout).toBe("result");
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

		it("should add specific files when provided", async () => {
			await gitAdd("/project", "src/index.ts");

			expect(mockExeca).toHaveBeenCalledWith("git", ["add", "src/index.ts"], {
				stdio: "pipe",
				cwd: "/project",
			});
		});
	});

	describe("gitCommit", () => {
		it("should create commit with message", async () => {
			await gitCommit("Initial commit", "/project");

			expect(mockExeca).toHaveBeenCalledWith(
				"git",
				["commit", "-m", "Initial commit"],
				{
					stdio: "pipe",
					cwd: "/project",
				},
			);
		});
	});
});
