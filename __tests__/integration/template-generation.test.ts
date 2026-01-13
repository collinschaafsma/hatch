import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as templates from "../../src/templates/index.js";
import { ensureDir, writeFile } from "../../src/utils/fs.js";

describe("template generation integration", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hatch-template-"));
	});

	afterEach(async () => {
		await fs.remove(tempDir);
	});

	describe("root config files", () => {
		it("should generate valid package.json", async () => {
			const content = templates.generateRootPackageJson("test-project");
			const filePath = path.join(tempDir, "package.json");
			await writeFile(filePath, content);

			const parsed = JSON.parse(await fs.readFile(filePath, "utf-8"));
			expect(parsed.name).toBe("test-project");
			expect(parsed.scripts).toBeDefined();
			expect(parsed.devDependencies).toBeDefined();
		});

		it("should generate valid turbo.json", async () => {
			const content = templates.generateTurboJson();
			const filePath = path.join(tempDir, "turbo.json");
			await writeFile(filePath, content);

			const parsed = JSON.parse(await fs.readFile(filePath, "utf-8"));
			expect(parsed.tasks).toBeDefined();
		});

		it("should generate valid biome.json", async () => {
			const content = templates.generateBiomeJson();
			const filePath = path.join(tempDir, "biome.json");
			await writeFile(filePath, content);

			const parsed = JSON.parse(await fs.readFile(filePath, "utf-8"));
			expect(parsed.$schema).toContain("biome");
		});

		it("should generate valid pnpm-workspace.yaml", async () => {
			const content = templates.generatePnpmWorkspace();
			const filePath = path.join(tempDir, "pnpm-workspace.yaml");
			await writeFile(filePath, content);

			const readContent = await fs.readFile(filePath, "utf-8");
			expect(readContent).toContain("packages:");
			expect(readContent).toContain("apps/*");
			expect(readContent).toContain("packages/*");
		});

		it("should generate valid .gitignore", async () => {
			const content = templates.generateGitignore();
			const filePath = path.join(tempDir, ".gitignore");
			await writeFile(filePath, content);

			const readContent = await fs.readFile(filePath, "utf-8");
			expect(readContent).toContain("node_modules");
			expect(readContent).toContain(".env");
		});
	});

	describe("web package files", () => {
		it("should generate valid web package.json with Better Auth", async () => {
			const content = templates.generateWebPackageJson(false);
			const filePath = path.join(tempDir, "package.json");
			await writeFile(filePath, content);

			const parsed = JSON.parse(await fs.readFile(filePath, "utf-8"));
			expect(parsed.name).toBe("web");
			expect(parsed.dependencies).toBeDefined();
			expect(parsed.dependencies["better-auth"]).toBeDefined();
		});

		it("should generate valid web package.json with WorkOS", async () => {
			const content = templates.generateWebPackageJson(true);
			const filePath = path.join(tempDir, "package.json");
			await writeFile(filePath, content);

			const parsed = JSON.parse(await fs.readFile(filePath, "utf-8"));
			expect(parsed.dependencies["@workos-inc/authkit-nextjs"]).toBeDefined();
			expect(parsed.dependencies["better-auth"]).toBeUndefined();
		});

		it("should generate valid components.json", async () => {
			const content = templates.generateComponentsJson();
			const filePath = path.join(tempDir, "components.json");
			await writeFile(filePath, content);

			const parsed = JSON.parse(await fs.readFile(filePath, "utf-8"));
			expect(parsed.$schema).toBeDefined();
			expect(parsed.style).toBeDefined();
		});
	});

	describe("auth configuration variations", () => {
		it("should generate Better Auth files", async () => {
			const webPath = path.join(tempDir, "apps", "web");
			await ensureDir(path.join(webPath, "lib"));

			await writeFile(
				path.join(webPath, "lib", "auth.ts"),
				templates.generateBetterAuthConfig(),
			);

			const content = await fs.readFile(
				path.join(webPath, "lib", "auth.ts"),
				"utf-8",
			);
			expect(content).toContain("betterAuth");
			expect(content).toContain("emailOTP");
		});

		it("should generate Better Auth client", async () => {
			const content = templates.generateBetterAuthClient();
			expect(content).toContain("createAuthClient");
			expect(content).toContain("emailOTPClient");
		});

		it("should generate WorkOS files", async () => {
			const webPath = path.join(tempDir, "apps", "web");
			await ensureDir(path.join(webPath, "app", "(auth)", "callback"));

			await writeFile(
				path.join(webPath, "app", "(auth)", "callback", "route.ts"),
				templates.generateWorkOSCallback(),
			);

			const content = await fs.readFile(
				path.join(webPath, "app", "(auth)", "callback", "route.ts"),
				"utf-8",
			);
			expect(content).toContain("@workos-inc/authkit-nextjs");
		});

		it("should generate different proxy for each auth type", () => {
			const betterAuthProxy = templates.generateBetterAuthProxy();
			const workosProxy = templates.generateWorkOSProxy();

			expect(betterAuthProxy).toContain("better-auth");
			expect(workosProxy).toContain("@workos-inc/authkit-nextjs");
		});
	});

	describe("dashboard page variations", () => {
		it("should generate dashboard page for Better Auth", () => {
			const content = templates.generateDashboardPage(false);
			expect(content).toContain("auth");
			expect(content).not.toContain("getUser");
		});

		it("should generate dashboard page for WorkOS", () => {
			const content = templates.generateDashboardPage(true);
			expect(content).toContain("withAuth");
			expect(content).toContain("@workos-inc/authkit-nextjs");
		});
	});

	describe("complete project structure simulation", () => {
		it("should generate full project structure", async () => {
			// Root files
			await writeFile(
				path.join(tempDir, "package.json"),
				templates.generateRootPackageJson("my-app"),
			);
			await writeFile(
				path.join(tempDir, "turbo.json"),
				templates.generateTurboJson(),
			);
			await writeFile(
				path.join(tempDir, "biome.json"),
				templates.generateBiomeJson(),
			);
			await writeFile(
				path.join(tempDir, "pnpm-workspace.yaml"),
				templates.generatePnpmWorkspace(),
			);
			await writeFile(
				path.join(tempDir, ".gitignore"),
				templates.generateGitignore(),
			);

			// Web app
			const webPath = path.join(tempDir, "apps", "web");
			await writeFile(
				path.join(webPath, "package.json"),
				templates.generateWebPackageJson(false),
			);
			await writeFile(
				path.join(webPath, "next.config.ts"),
				templates.generateNextConfig(),
			);
			await writeFile(
				path.join(webPath, "tsconfig.json"),
				templates.generateWebTsconfig(),
			);

			// Verify structure
			expect(await fs.pathExists(path.join(tempDir, "package.json"))).toBe(
				true,
			);
			expect(await fs.pathExists(path.join(tempDir, "turbo.json"))).toBe(true);
			expect(await fs.pathExists(path.join(tempDir, "biome.json"))).toBe(true);
			expect(await fs.pathExists(path.join(webPath, "package.json"))).toBe(
				true,
			);
			expect(await fs.pathExists(path.join(webPath, "next.config.ts"))).toBe(
				true,
			);

			// Verify root package.json content
			const rootPkg = JSON.parse(
				await fs.readFile(path.join(tempDir, "package.json"), "utf-8"),
			);
			expect(rootPkg.name).toBe("my-app");
		});
	});

	describe("database templates", () => {
		it("should generate valid Drizzle config", async () => {
			const content = templates.generateDrizzleConfig();
			const filePath = path.join(tempDir, "drizzle.config.ts");
			await writeFile(filePath, content);

			const readContent = await fs.readFile(filePath, "utf-8");
			expect(readContent).toContain("defineConfig");
			expect(readContent).toContain("dialect");
		});

		it("should generate valid DB schema", () => {
			const content = templates.generateDbSchema();
			expect(content).toContain("pgTable");
			expect(content).toContain("posts");
		});
	});

	describe("UI package templates", () => {
		it("should generate valid UI package.json", async () => {
			const content = templates.generateUIPackageJson();
			const filePath = path.join(tempDir, "package.json");
			await writeFile(filePath, content);

			const parsed = JSON.parse(await fs.readFile(filePath, "utf-8"));
			expect(parsed.name).toBe("@repo/ui");
		});
	});

	describe("docker templates", () => {
		it("should generate valid docker-compose.yml", async () => {
			const content = templates.generateDockerCompose();
			const filePath = path.join(tempDir, "docker-compose.yml");
			await writeFile(filePath, content);

			const readContent = await fs.readFile(filePath, "utf-8");
			expect(readContent).toContain("services:");
			expect(readContent).toContain("postgres");
		});
	});
});
