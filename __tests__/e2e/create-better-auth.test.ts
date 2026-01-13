import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import fs from "fs-extra";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("E2E: create project (Better Auth)", () => {
	let tempDir: string;
	let projectDir: string;
	const projectName = "test-better-auth-project";

	beforeAll(async () => {
		// Create temp directory for E2E tests
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hatch-e2e-"));
		projectDir = path.join(tempDir, projectName);

		// Run the CLI
		const cliPath = path.resolve(__dirname, "../../src/index.ts");
		await execa("tsx", [cliPath, "create", projectName], {
			cwd: tempDir,
			env: {
				...process.env,
				CI: "true",
			},
		});
	}, 600000);

	afterAll(async () => {
		// Cleanup
		await fs.remove(tempDir);
	});

	it("should create the project directory", async () => {
		expect(await fs.pathExists(projectDir)).toBe(true);
	});

	it("should have correct root files", async () => {
		const files = [
			"package.json",
			"turbo.json",
			"biome.json",
			"pnpm-workspace.yaml",
			".gitignore",
			"docker-compose.yml",
		];
		for (const file of files) {
			expect(await fs.pathExists(path.join(projectDir, file))).toBe(true);
		}
	});

	it("should have correct package.json content", async () => {
		const pkg = await fs.readJson(path.join(projectDir, "package.json"));
		expect(pkg.name).toBe(projectName);
		expect(pkg.scripts.dev).toBeDefined();
		expect(pkg.scripts.build).toBeDefined();
		expect(pkg.scripts.lint).toBeDefined();
	});

	it("should have apps/web structure", async () => {
		const webPath = path.join(projectDir, "apps", "web");
		expect(await fs.pathExists(webPath)).toBe(true);
		expect(await fs.pathExists(path.join(webPath, "package.json"))).toBe(true);
		expect(await fs.pathExists(path.join(webPath, "app"))).toBe(true);
		expect(await fs.pathExists(path.join(webPath, "next.config.ts"))).toBe(
			true,
		);
	});

	it("should have Better Auth configuration", async () => {
		const webPath = path.join(projectDir, "apps", "web");
		expect(await fs.pathExists(path.join(webPath, "lib", "auth.ts"))).toBe(
			true,
		);
		expect(
			await fs.pathExists(path.join(webPath, "lib", "auth-client.ts")),
		).toBe(true);

		const authContent = await fs.readFile(
			path.join(webPath, "lib", "auth.ts"),
			"utf-8",
		);
		expect(authContent).toContain("betterAuth");
	});

	it("should have database configuration", async () => {
		const webPath = path.join(projectDir, "apps", "web");
		expect(await fs.pathExists(path.join(webPath, "db", "index.ts"))).toBe(
			true,
		);
		expect(await fs.pathExists(path.join(webPath, "db", "schema.ts"))).toBe(
			true,
		);
		expect(await fs.pathExists(path.join(webPath, "drizzle.config.ts"))).toBe(
			true,
		);
	});

	it("should have AI and workflow setup", async () => {
		const webPath = path.join(projectDir, "apps", "web");
		expect(
			await fs.pathExists(path.join(webPath, "app", "api", "chat", "route.ts")),
		).toBe(true);
		expect(
			await fs.pathExists(path.join(webPath, "workflows", "ai-agent.ts")),
		).toBe(true);
	});

	it("should have test setup", async () => {
		const webPath = path.join(projectDir, "apps", "web");
		expect(await fs.pathExists(path.join(webPath, "vitest.config.mts"))).toBe(
			true,
		);
		expect(await fs.pathExists(path.join(webPath, "__tests__"))).toBe(true);
	});

	it("should have packages/ui", async () => {
		const uiPath = path.join(projectDir, "packages", "ui");
		expect(await fs.pathExists(uiPath)).toBe(true);
		expect(await fs.pathExists(path.join(uiPath, "package.json"))).toBe(true);
	});

	it("should have git initialized", async () => {
		expect(await fs.pathExists(path.join(projectDir, ".git"))).toBe(true);
	});

	it("should have node_modules installed", async () => {
		expect(await fs.pathExists(path.join(projectDir, "node_modules"))).toBe(
			true,
		);
	});

	it("should have dashboard page with Better Auth", async () => {
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
		expect(content).not.toContain("@workos-inc/authkit-nextjs");
	});

	it("should have login page for Better Auth", async () => {
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
	});

	it("should have verify-otp page for Better Auth", async () => {
		const verifyPath = path.join(
			projectDir,
			"apps",
			"web",
			"app",
			"(auth)",
			"verify-otp",
			"page.tsx",
		);
		expect(await fs.pathExists(verifyPath)).toBe(true);
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
