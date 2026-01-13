import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import fs from "fs-extra";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("E2E: create project (WorkOS)", () => {
	let tempDir: string;
	let projectDir: string;
	const projectName = "test-workos-project";

	beforeAll(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hatch-e2e-workos-"));
		projectDir = path.join(tempDir, projectName);

		// Run the CLI with --workos flag
		const cliPath = path.resolve(__dirname, "../../src/index.ts");
		await execa("tsx", [cliPath, "create", projectName, "--workos"], {
			cwd: tempDir,
			env: { ...process.env, CI: "true" },
		});
	}, 600000);

	afterAll(async () => {
		await fs.remove(tempDir);
	});

	it("should create the project directory", async () => {
		expect(await fs.pathExists(projectDir)).toBe(true);
	});

	it("should have WorkOS configuration instead of Better Auth", async () => {
		const webPath = path.join(projectDir, "apps", "web");

		// Should NOT have Better Auth files
		expect(await fs.pathExists(path.join(webPath, "lib", "auth.ts"))).toBe(
			false,
		);
		expect(
			await fs.pathExists(path.join(webPath, "lib", "auth-client.ts")),
		).toBe(false);

		// Should have WorkOS callback route
		expect(
			await fs.pathExists(
				path.join(webPath, "app", "(auth)", "callback", "route.ts"),
			),
		).toBe(true);

		// Verify WorkOS proxy
		const proxyContent = await fs.readFile(
			path.join(webPath, "proxy.ts"),
			"utf-8",
		);
		expect(proxyContent).toContain("@workos-inc/authkit-nextjs");
	});

	it("should have WorkOS package in dependencies", async () => {
		const pkg = await fs.readJson(
			path.join(projectDir, "apps", "web", "package.json"),
		);
		expect(pkg.dependencies["@workos-inc/authkit-nextjs"]).toBeDefined();
		expect(pkg.dependencies["better-auth"]).toBeUndefined();
	});

	it("should have WorkOS login page", async () => {
		const loginPath = path.join(
			projectDir,
			"apps",
			"web",
			"app",
			"(auth)",
			"login",
			"page.tsx",
		);
		expect(await fs.pathExists(loginPath)).toBe(true);
		const content = await fs.readFile(loginPath, "utf-8");
		expect(content).toContain("signIn");
		expect(content).toContain("@workos-inc/authkit-nextjs");
	});

	it("should have dashboard page with WorkOS auth", async () => {
		const dashboardPath = path.join(
			projectDir,
			"apps",
			"web",
			"app",
			"(app)",
			"dashboard",
			"page.tsx",
		);
		expect(await fs.pathExists(dashboardPath)).toBe(true);
		const content = await fs.readFile(dashboardPath, "utf-8");
		expect(content).toContain("@workos-inc/authkit-nextjs");
	});

	it("should have auth callback route for WorkOS OAuth", async () => {
		const callbackPath = path.join(
			projectDir,
			"apps",
			"web",
			"app",
			"(auth)",
			"callback",
			"route.ts",
		);
		expect(await fs.pathExists(callbackPath)).toBe(true);
		const content = await fs.readFile(callbackPath, "utf-8");
		expect(content).toContain("@workos-inc/authkit-nextjs");
	});

	it("should have correct root files", async () => {
		const files = [
			"package.json",
			"turbo.json",
			"biome.json",
			"pnpm-workspace.yaml",
		];
		for (const file of files) {
			expect(await fs.pathExists(path.join(projectDir, file))).toBe(true);
		}
	});

	it("should have git initialized", async () => {
		expect(await fs.pathExists(path.join(projectDir, ".git"))).toBe(true);
	});

	it("should have node_modules installed", async () => {
		expect(await fs.pathExists(path.join(projectDir, "node_modules"))).toBe(
			true,
		);
	});

	it("should pass biome lint check", async () => {
		const result = await execa("pnpm", ["lint"], {
			cwd: projectDir,
			reject: false,
		});
		if (result.exitCode !== 0) {
			console.error("Lint failed:", result.stdout, result.stderr);
		}
		expect(result.exitCode).toBe(0);
	}, 60000);

	it("should build successfully", async () => {
		const result = await execa("pnpm", ["build"], {
			cwd: projectDir,
			reject: false,
		});
		if (result.exitCode !== 0) {
			console.error("Build failed:", result.stdout, result.stderr);
		}
		expect(result.exitCode).toBe(0);
	}, 300000);
});
