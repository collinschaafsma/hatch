import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import {
	outputResult,
	resolveConfig,
	runHeadlessSetup,
	validateHeadlessOptions,
} from "../headless/index.js";
import * as templates from "../templates/index.js";
import type { HeadlessOptions } from "../types/index.js";
import {
	gitAdd,
	gitCommit,
	gitInit,
	npxCommand,
	pnpmDlx,
	pnpmInstall,
	pnpmRun,
} from "../utils/exec.js";
import {
	copyDir,
	ensureDir,
	fileExists,
	setExecutable,
	writeFile,
} from "../utils/fs.js";
import { log } from "../utils/logger.js";
import { getProjectPrompts } from "../utils/prompts.js";
import { withSpinner } from "../utils/spinner.js";

// Get the package root directory for copying static assets
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "../..");

interface CreateCommandOptions {
	workos: boolean;
	convex: boolean;
	vscode: boolean;
	// Headless mode options
	headless: boolean;
	bootstrap: boolean;
	config?: string;
	githubToken?: string;
	githubOrg?: string;
	vercelToken?: string;
	vercelTeam?: string;
	supabaseToken?: string;
	supabaseOrg?: string;
	supabaseRegion: string;
	conflictStrategy: "suffix" | "fail";
	json: boolean;
	quiet: boolean;
}

export const createCommand = new Command()
	.name("create")
	.description("Create a new Hatch project")
	.argument("[project-name]", "Name of the project")
	.option("--workos", "Use WorkOS instead of Better Auth", false)
	.option("--convex", "Use Convex instead of Supabase for the backend", false)
	.option("--no-vscode", "Skip generating VS Code configuration files")
	// Headless mode options
	.option("--headless", "Run in non-interactive headless mode", false)
	.option(
		"--bootstrap",
		"Install missing CLIs (gh, vercel, supabase) before running",
		false,
	)
	.option(
		"--config <path>",
		"Path to hatch.json config file (default: ./hatch.json or ~/.hatch.json)",
	)
	.option("--github-token <token>", "GitHub PAT (env: GITHUB_TOKEN)")
	.option("--github-org <org>", "GitHub organization (env: HATCH_GITHUB_ORG)")
	.option("--vercel-token <token>", "Vercel access token (env: VERCEL_TOKEN)")
	.option("--vercel-team <id>", "Vercel team ID (env: HATCH_VERCEL_TEAM)")
	.option(
		"--supabase-token <token>",
		"Supabase access token (env: SUPABASE_ACCESS_TOKEN)",
	)
	.option("--supabase-org <id>", "Supabase org ID (env: HATCH_SUPABASE_ORG)")
	.option(
		"--supabase-region <region>",
		"Supabase region (default: us-east-1)",
		"us-east-1",
	)
	.option(
		"--conflict-strategy <strategy>",
		"How to handle name conflicts: suffix or fail",
		"suffix",
	)
	.option("--json", "Output results as JSON (headless mode only)", false)
	.option("--quiet", "Suppress progress output (headless mode only)", false)
	.action(
		async (projectName: string | undefined, options: CreateCommandOptions) => {
			try {
				// Headless mode requires project name
				if (options.headless && !projectName) {
					log.error("Project name is required in headless mode");
					process.exit(1);
				}

				// Validate: --convex and --workos are mutually exclusive
				if (options.convex && options.workos) {
					log.error(
						"--convex and --workos are mutually exclusive. Convex uses Better Auth only.",
					);
					process.exit(1);
				}

				// Get project options (skip prompts in headless mode)
				let inputName: string;
				let useWorkOS: boolean;
				const useConvex = options.convex;

				if (options.headless) {
					inputName = projectName as string;
					useWorkOS = options.workos;
				} else {
					const projectOptions = await getProjectPrompts(
						projectName,
						options.workos,
					);
					inputName = projectOptions.projectName;
					useWorkOS = projectOptions.useWorkOS;
				}

				const includeVSCode = options.vscode;

				const projectPath = path.resolve(process.cwd(), inputName);
				// Extract just the directory name for use in templates
				const name = path.basename(projectPath);

				// Check if directory exists
				if (await fileExists(projectPath)) {
					if (options.headless) {
						if (options.json) {
							console.log(
								JSON.stringify({
									success: false,
									error: `Directory "${name}" already exists.`,
								}),
							);
						} else if (!options.quiet) {
							log.error(`Directory "${name}" already exists.`);
						}
						process.exit(1);
					}
					log.error(`Directory "${name}" already exists.`);
					process.exit(1);
				}

				// In headless mode with quiet, suppress initial logging
				if (!options.headless || !options.quiet) {
					log.blank();
					log.info(`Creating project "${name}"...`);
					log.info(
						`Auth provider: ${useWorkOS ? "WorkOS" : "Better Auth (Email OTP)"}`,
					);
					log.info(
						`Backend: ${useConvex ? "Convex (serverless)" : "Supabase (cloud)"}`,
					);
					log.info(`VS Code config: ${includeVSCode ? "included" : "skipped"}`);
					if (options.headless) {
						log.info("Mode: headless");
					}
					log.blank();
				}

				// Create root directory and config files
				await withSpinner("Creating project structure", async () => {
					await ensureDir(projectPath);
					await ensureDir(path.join(projectPath, "apps"));
					await ensureDir(path.join(projectPath, "packages"));
				});

				// Generate root configuration files
				await withSpinner("Generating root configuration", async () => {
					await writeFile(
						path.join(projectPath, "package.json"),
						templates.generateRootPackageJson(name),
					);
					await writeFile(
						path.join(projectPath, "pnpm-workspace.yaml"),
						templates.generatePnpmWorkspace(),
					);
					await writeFile(
						path.join(projectPath, "turbo.json"),
						templates.generateTurboJson(),
					);
					await writeFile(
						path.join(projectPath, "biome.json"),
						templates.generateBiomeJson(),
					);
					await writeFile(
						path.join(projectPath, ".gitignore"),
						templates.generateGitignore(),
					);
					await writeFile(
						path.join(projectPath, "CLAUDE.md"),
						templates.generateClaudeMd(name, useWorkOS, useConvex),
					);
					await writeFile(
						path.join(projectPath, "README.md"),
						templates.generateReadme(name, useConvex),
					);
				});

				// Generate backend configuration
				if (useConvex) {
					await withSpinner("Setting up Convex configuration", async () => {
						const convexDir = path.join(projectPath, "apps", "web", "convex");
						await ensureDir(convexDir);
						await ensureDir(path.join(convexDir, "_generated"));
						await ensureDir(path.join(convexDir, "betterAuth"));

						// App-level Convex files
						await writeFile(
							path.join(convexDir, "schema.ts"),
							templates.generateConvexSchema(),
						);
						await writeFile(
							path.join(convexDir, "functions.ts"),
							templates.generateConvexFunctions(),
						);
						await writeFile(
							path.join(convexDir, "seed.ts"),
							templates.generateConvexSeed(),
						);
						await writeFile(
							path.join(convexDir, "convex.config.ts"),
							templates.generateConvexConvexConfig(),
						);
						await writeFile(
							path.join(convexDir, "auth.config.ts"),
							templates.generateConvexAuthConfigTs(),
						);
						await writeFile(
							path.join(convexDir, "http.ts"),
							templates.generateConvexHttp(),
						);

						// Better Auth component files
						await writeFile(
							path.join(convexDir, "betterAuth", "convex.config.ts"),
							templates.generateConvexBetterAuthComponentConfig(),
						);
						await writeFile(
							path.join(convexDir, "betterAuth", "auth.ts"),
							templates.generateConvexBetterAuthModule(),
						);
						await writeFile(
							path.join(convexDir, "betterAuth", "schema.ts"),
							templates.generateConvexBetterAuthSchema(),
						);
						await writeFile(
							path.join(convexDir, "betterAuth", "adapter.ts"),
							templates.generateConvexBetterAuthAdapter(),
						);

						// Stubs for _generated/ (replaced by `npx convex dev`)
						await writeFile(
							path.join(convexDir, "_generated", "server.ts"),
							templates.generateConvexServerStub(),
						);
						await writeFile(
							path.join(convexDir, "_generated", "dataModel.ts"),
							templates.generateConvexDataModelStub(),
						);
						await writeFile(
							path.join(convexDir, "_generated", "api.ts"),
							templates.generateConvexApiStub(),
						);
					});
				} else {
					await withSpinner("Setting up Supabase configuration", async () => {
						await ensureDir(path.join(projectPath, "supabase"));

						await writeFile(
							path.join(projectPath, "supabase", "config.toml"),
							templates.generateSupabaseConfig(),
						);
						await writeFile(
							path.join(projectPath, "supabase", "seed.sql"),
							templates.generateSupabaseSeedSql(useWorkOS),
						);
					});
				}

				// Generate VS Code configuration
				if (includeVSCode) {
					await withSpinner("Setting up VS Code configuration", async () => {
						await ensureDir(path.join(projectPath, ".vscode"));
						await writeFile(
							path.join(projectPath, ".vscode", "extensions.json"),
							templates.generateVSCodeExtensions(),
						);
						await writeFile(
							path.join(projectPath, ".vscode", "settings.json"),
							templates.generateVSCodeSettings(),
						);
					});
				}

				// Generate scripts
				await withSpinner("Setting up scripts", async () => {
					await ensureDir(path.join(projectPath, "scripts"));
					await ensureDir(path.join(projectPath, ".claude"));

					if (!useConvex) {
						// Supabase scripts
						const supabaseSetupPath = path.join(
							projectPath,
							"scripts",
							"supabase-setup",
						);
						const supabaseBranchPath = path.join(
							projectPath,
							"scripts",
							"supabase-branch",
						);
						const supabaseEnvPath = path.join(
							projectPath,
							"scripts",
							"supabase-env",
						);

						await writeFile(
							supabaseSetupPath,
							templates.generateSupabaseSetupScript(),
						);
						await writeFile(
							supabaseBranchPath,
							templates.generateSupabaseBranchScript(),
						);
						await writeFile(
							supabaseEnvPath,
							templates.generateSupabaseEnvScript(),
						);

						await setExecutable(supabaseSetupPath);
						await setExecutable(supabaseBranchPath);
						await setExecutable(supabaseEnvPath);
					}

					// Setup script (generated for all projects)
					const setupScriptPath = path.join(projectPath, "scripts", "setup");
					await writeFile(
						setupScriptPath,
						templates.generateSetupScript(name, useWorkOS),
					);
					await setExecutable(setupScriptPath);

					// Claude settings and skills
					await ensureDir(
						path.join(projectPath, ".claude", "skills", "typecheck"),
					);
					await ensureDir(path.join(projectPath, ".claude", "skills", "test"));
					await ensureDir(
						path.join(projectPath, ".claude", "skills", "db-migrate"),
					);

					await writeFile(
						path.join(
							projectPath,
							".claude",
							"skills",
							"typecheck",
							"SKILL.md",
						),
						templates.generateTypecheckSkill(),
					);
					await writeFile(
						path.join(projectPath, ".claude", "skills", "test", "SKILL.md"),
						templates.generateTestSkill(),
					);
					await writeFile(
						path.join(
							projectPath,
							".claude",
							"skills",
							"db-migrate",
							"SKILL.md",
						),
						templates.generateDbMigrateSkill(),
					);
				});

				// Install external Claude Code skills from GitHub repos
				await withSpinner("Installing Claude Code skills", async () => {
					const skillsByRepo = [
						{
							repo: "https://github.com/vercel-labs/agent-skills",
							skills: [
								"vercel-react-best-practices",
								"web-design-guidelines",
								"vercel-composition-patterns",
							],
						},
						{
							repo: "https://github.com/vercel-labs/skills",
							skills: ["find-skills"],
						},
						{
							repo: "https://github.com/better-auth/skills",
							skills: ["better-auth-best-practices"],
						},
						{
							repo: "https://github.com/anthropics/skills",
							skills: ["frontend-design"],
						},
						{
							repo: "https://github.com/vercel/ai",
							skills: ["ai-sdk"],
						},
						{
							repo: "https://github.com/benjitaylor/agentation",
							skills: ["agentation"],
						},
						{
							repo: "https://github.com/vercel-labs/next-skills",
							skills: ["next-cache-components", "next-best-practices"],
						},
						{
							repo: "https://github.com/vercel-labs/agent-browser",
							skills: ["agent-browser"],
						},
					];

					for (const { repo, skills } of skillsByRepo) {
						try {
							await npxCommand(
								"skills",
								["add", repo, "--skill", ...skills, "-a", "claude-code", "-y"],
								projectPath,
							);
						} catch (error) {
							// Log warning but don't fail the entire setup
							// Skills installation is non-fatal
							log.warn(
								`Failed to install skills from ${repo}: ${error instanceof Error ? error.message : String(error)}`,
							);
						}
					}
				});

				// Create apps/web structure
				const webPath = path.join(projectPath, "apps", "web");

				await withSpinner("Setting up Next.js app", async () => {
					// Create directories
					await ensureDir(path.join(webPath, "app"));
					await ensureDir(path.join(webPath, "app", "(auth)", "login"));
					await ensureDir(path.join(webPath, "app", "(auth)", "verify-otp"));
					await ensureDir(path.join(webPath, "app", "(auth)", "callback"));
					await ensureDir(
						path.join(webPath, "app", "(marketing)", "_components"),
					);
					await ensureDir(
						path.join(webPath, "app", "(app)", "dashboard", "_components"),
					);
					await ensureDir(path.join(webPath, "app", "api", "auth", "[...all]"));
					await ensureDir(path.join(webPath, "app", "api", "chat"));
					await ensureDir(path.join(webPath, "app", "api", "workflow"));
					await ensureDir(
						path.join(webPath, "app", "api", "workflow-progress", "[runId]"),
					);
					await ensureDir(path.join(webPath, "components", "providers"));
					await ensureDir(path.join(webPath, "lib"));
					await ensureDir(path.join(webPath, "lib", "workflow-progress"));
					await ensureDir(path.join(webPath, "hooks"));
					await ensureDir(path.join(webPath, "db"));
					await ensureDir(path.join(webPath, "workflows"));

					// Generate web app files
					await writeFile(
						path.join(webPath, "package.json"),
						templates.generateWebPackageJson(useWorkOS, useConvex),
					);
					await writeFile(
						path.join(webPath, "next.config.ts"),
						templates.generateNextConfig(),
					);
					await writeFile(
						path.join(webPath, "tsconfig.json"),
						templates.generateWebTsconfig(),
					);
					await writeFile(
						path.join(webPath, "tailwind.config.ts"),
						templates.generateTailwindConfig(),
					);
					await writeFile(
						path.join(webPath, "postcss.config.mjs"),
						templates.generatePostcssConfig(),
					);
					await writeFile(
						path.join(webPath, ".env.local.example"),
						templates.generateEnvExample(useWorkOS, name, useConvex),
					);
					await writeFile(
						path.join(webPath, "vercel.json"),
						templates.generateVercelJson(useConvex),
					);
					await writeFile(
						path.join(webPath, ".gitignore"),
						templates.generateWebGitignore(),
					);
					await writeFile(
						path.join(webPath, "components.json"),
						templates.generateWebComponentsJson(),
					);

					// App files
					await writeFile(
						path.join(webPath, "app", "layout.tsx"),
						templates.generateRootLayout(useWorkOS, name),
					);
					await writeFile(
						path.join(webPath, "app", "globals.css"),
						templates.generateGlobalsCss(),
					);

					// Marketing page files
					await writeFile(
						path.join(webPath, "app", "(marketing)", "page.tsx"),
						templates.generateMarketingPage(name),
					);
					await writeFile(
						path.join(webPath, "app", "(marketing)", "_components", "hero.tsx"),
						templates.generateHero(),
					);
					await writeFile(
						path.join(
							webPath,
							"app",
							"(marketing)",
							"_components",
							"footer.tsx",
						),
						templates.generateFooter(),
					);

					// SEO files
					await writeFile(
						path.join(webPath, "app", "robots.ts"),
						templates.generateRobots(),
					);
					await writeFile(
						path.join(webPath, "app", "sitemap.ts"),
						templates.generateSitemap(),
					);
					await writeFile(
						path.join(webPath, "app", "manifest.ts"),
						templates.generateManifest(name),
					);
					await writeFile(
						path.join(webPath, "app", "opengraph-image.tsx"),
						templates.generateOpengraphImage(name),
					);
					await ensureDir(path.join(webPath, "public"));
					await writeFile(
						path.join(webPath, "public", "llms.txt"),
						templates.generateLlmsTxt(name),
					);

					// App layout
					await writeFile(
						path.join(webPath, "app", "(app)", "layout.tsx"),
						templates.generateAppLayout(),
					);
				});

				// Generate database files (Supabase only - Convex uses convex/ directory)
				if (!useConvex) {
					await withSpinner("Setting up database", async () => {
						await writeFile(
							path.join(webPath, "db", "index.ts"),
							templates.generateDbIndex(),
						);
						await writeFile(
							path.join(webPath, "db", "schema.ts"),
							templates.generateDbSchema(useWorkOS),
						);
						await writeFile(
							path.join(webPath, "drizzle.config.ts"),
							templates.generateDrizzleConfig(),
						);
					});
				}

				// Generate auth files
				await withSpinner("Setting up authentication", async () => {
					if (useWorkOS) {
						// WorkOS auth
						await writeFile(
							path.join(webPath, "app", "(auth)", "callback", "route.ts"),
							templates.generateWorkOSCallback(),
						);
						await writeFile(
							path.join(webPath, "app", "(auth)", "login", "page.tsx"),
							templates.generateWorkOSLoginPage(),
						);
						await writeFile(
							path.join(webPath, "proxy.ts"),
							templates.generateWorkOSProxy(),
						);
					} else if (useConvex) {
						// Better Auth with Convex component
						await writeFile(
							path.join(webPath, "lib", "auth.ts"),
							templates.generateConvexAuthConfig(),
						);
						await writeFile(
							path.join(webPath, "lib", "auth-client.ts"),
							templates.generateConvexAuthClient(),
						);
						await writeFile(
							path.join(webPath, "app", "api", "auth", "[...all]", "route.ts"),
							templates.generateConvexAuthRouteHandler(),
						);
						await writeFile(
							path.join(webPath, "app", "(auth)", "login", "page.tsx"),
							templates.generateLoginPage(),
						);
						await writeFile(
							path.join(webPath, "app", "(auth)", "verify-otp", "page.tsx"),
							templates.generateVerifyOTPPage(),
						);
						await writeFile(
							path.join(webPath, "proxy.ts"),
							templates.generateBetterAuthProxy(),
						);
						await writeFile(
							path.join(
								webPath,
								"components",
								"providers",
								"convex-provider.tsx",
							),
							templates.generateConvexProvider(),
						);
					} else {
						// Better Auth with Drizzle/Supabase
						await writeFile(
							path.join(webPath, "lib", "auth.ts"),
							templates.generateBetterAuthConfig(),
						);
						await writeFile(
							path.join(webPath, "lib", "auth-client.ts"),
							templates.generateBetterAuthClient(),
						);
						await writeFile(
							path.join(webPath, "app", "api", "auth", "[...all]", "route.ts"),
							templates.generateBetterAuthRouteHandler(),
						);
						await writeFile(
							path.join(webPath, "app", "(auth)", "login", "page.tsx"),
							templates.generateLoginPage(),
						);
						await writeFile(
							path.join(webPath, "app", "(auth)", "verify-otp", "page.tsx"),
							templates.generateVerifyOTPPage(),
						);
						await writeFile(
							path.join(webPath, "proxy.ts"),
							templates.generateBetterAuthProxy(),
						);
					}
				});

				// Generate AI and workflow files
				await withSpinner("Setting up AI and workflows", async () => {
					await writeFile(
						path.join(webPath, "app", "api", "chat", "route.ts"),
						templates.generateChatRoute(),
					);
					await writeFile(
						path.join(webPath, "workflows", "ai-agent.ts"),
						templates.generateExampleWorkflow(),
					);
					await writeFile(
						path.join(webPath, "app", "api", "workflow", "route.ts"),
						templates.generateWorkflowRoute(),
					);
					// Workflow progress streaming
					await writeFile(
						path.join(webPath, "lib", "workflow-progress", "types.ts"),
						templates.generateWorkflowProgressTypes(),
					);
					await writeFile(
						path.join(
							webPath,
							"app",
							"api",
							"workflow-progress",
							"[runId]",
							"route.ts",
						),
						templates.generateWorkflowProgressRoute({ useWorkOS }),
					);
					await writeFile(
						path.join(webPath, "hooks", "use-workflow-progress.ts"),
						templates.generateUseWorkflowProgress(),
					);
					await writeFile(
						path.join(webPath, "hooks", "use-latest.ts"),
						templates.generateUseLatest(),
					);
				});

				// Generate analytics files
				await withSpinner("Setting up PostHog analytics", async () => {
					await writeFile(
						path.join(webPath, "components", "providers", "posthog.tsx"),
						templates.generatePostHogProvider(),
					);
					await writeFile(
						path.join(webPath, "lib", "posthog.ts"),
						templates.generatePostHogServer(),
					);
				});

				// Generate dashboard files
				await withSpinner("Setting up dashboard", async () => {
					await writeFile(
						path.join(webPath, "app", "(app)", "dashboard", "page.tsx"),
						templates.generateDashboardPage(useWorkOS),
					);
					await writeFile(
						path.join(
							webPath,
							"app",
							"(app)",
							"dashboard",
							"_components",
							"ai-trigger.tsx",
						),
						templates.generateAITriggerButton(),
					);
					await writeFile(
						path.join(
							webPath,
							"app",
							"(app)",
							"dashboard",
							"_components",
							"skeleton.tsx",
						),
						templates.generateDashboardSkeleton(),
					);
					if (!useWorkOS) {
						await writeFile(
							path.join(
								webPath,
								"app",
								"(app)",
								"dashboard",
								"_components",
								"sign-out-button.tsx",
							),
							templates.generateSignOutButton(),
						);
					}
				});

				// Generate test setup
				await withSpinner("Setting up Vitest testing", async () => {
					// Create __tests__ directories
					await ensureDir(path.join(webPath, "__tests__"));
					await ensureDir(path.join(webPath, "__tests__", "utils"));
					await ensureDir(path.join(webPath, "__tests__", "unit"));
					await ensureDir(path.join(webPath, "__tests__", "components"));
					await ensureDir(path.join(webPath, "__tests__", "integration"));
					await ensureDir(path.join(webPath, "__tests__", "factories"));

					// Config files
					await writeFile(
						path.join(webPath, "vitest.config.mts"),
						templates.generateVitestConfig(),
					);
					await writeFile(
						path.join(webPath, "vitest.setup.ts"),
						templates.generateVitestSetup(),
					);

					// Test utilities
					await writeFile(
						path.join(webPath, "__tests__", "utils", "test-db.ts"),
						useConvex
							? templates.generateConvexTestDbUtils()
							: templates.generateTestDbUtils(name, useWorkOS),
					);
					await writeFile(
						path.join(webPath, "__tests__", "utils", "mocks.ts"),
						templates.generateTestMocks(),
					);
					await writeFile(
						path.join(webPath, "__tests__", "utils", "render.tsx"),
						templates.generateTestRenderUtils(),
					);

					// Test factories
					await writeFile(
						path.join(webPath, "__tests__", "factories", "user.ts"),
						templates.generateUserFactory(useWorkOS),
					);
					if (useWorkOS) {
						await writeFile(
							path.join(webPath, "__tests__", "factories", "organization.ts"),
							templates.generateOrganizationFactory(),
						);
					}
					await writeFile(
						path.join(webPath, "__tests__", "factories", "index.ts"),
						templates.generateFactoriesIndex(useWorkOS),
					);

					// Example tests
					await writeFile(
						path.join(webPath, "__tests__", "unit", "utils.test.ts"),
						templates.generateUtilsTest(),
					);
					await writeFile(
						path.join(
							webPath,
							"__tests__",
							"components",
							"ai-trigger.test.tsx",
						),
						templates.generateAiTriggerTest(),
					);
					if (!useConvex) {
						await writeFile(
							path.join(webPath, "__tests__", "integration", "db.test.ts"),
							useWorkOS
								? templates.generateWorkOSDbTest(name)
								: templates.generateDbTest(name),
						);
					}
				});

				// Generate services layer
				await withSpinner("Setting up services layer", async () => {
					await ensureDir(path.join(webPath, "services"));

					await writeFile(
						path.join(webPath, "services", "user.ts"),
						templates.generateUserService(useWorkOS),
					);
					await writeFile(
						path.join(webPath, "services", "index.ts"),
						templates.generateServicesIndex(),
					);
				});

				// Generate safe-action and logger
				await withSpinner("Setting up safe-action and logger", async () => {
					await ensureDir(path.join(webPath, "lib", "logger"));

					// Safe action client
					await writeFile(
						path.join(webPath, "lib", "safe-action.ts"),
						templates.generateSafeAction(useWorkOS),
					);

					// Logger (server and client)
					await writeFile(
						path.join(webPath, "lib", "logger", "server.ts"),
						templates.generateServerLogger(),
					);
					await writeFile(
						path.join(webPath, "lib", "logger", "client.ts"),
						templates.generateClientLogger(),
					);

					// Dashboard actions example
					await writeFile(
						path.join(webPath, "app", "(app)", "dashboard", "_actions.ts"),
						templates.generateDashboardActions(),
					);
				});

				// Create packages/ui structure
				const uiPath = path.join(projectPath, "packages", "ui");

				await withSpinner("Setting up UI package", async () => {
					await ensureDir(path.join(uiPath, "src"));
					await ensureDir(path.join(uiPath, "src", "components"));
					await ensureDir(path.join(uiPath, "src", "lib"));
					await ensureDir(path.join(uiPath, "src", "hooks"));

					await writeFile(
						path.join(uiPath, "package.json"),
						templates.generateUIPackageJson(),
					);
					await writeFile(
						path.join(uiPath, "tsconfig.json"),
						templates.generateUITsconfig(),
					);
					await writeFile(
						path.join(uiPath, "src", "index.ts"),
						templates.generateUIIndex(),
					);
					await writeFile(
						path.join(uiPath, "components.json"),
						templates.generateUIComponentsJson(),
					);
					await writeFile(
						path.join(uiPath, "src", "lib", "utils.ts"),
						templates.generateUILibUtils(),
					);
				});

				// Install dependencies
				await withSpinner(
					"Installing dependencies (this may take a while)",
					async () => {
						await pnpmInstall(projectPath);
					},
				);

				// Initialize shadcn in packages/ui
				await withSpinner("Initializing shadcn/ui", async () => {
					try {
						await pnpmDlx("shadcn@latest", ["init", "-y"], uiPath);
					} catch (error) {
						// shadcn init might fail if components.json already exists, that's ok
						log.warn("shadcn init skipped (components.json already exists)");
					}
				});

				// Add shadcn components to packages/ui
				await withSpinner("Adding shadcn components", async () => {
					const components = [
						"button",
						"input",
						"card",
						"label",
						"avatar",
						"dropdown-menu",
						"separator",
					];

					try {
						await pnpmDlx(
							"shadcn@latest",
							["add", ...components, "-y"],
							uiPath,
						);
					} catch (error) {
						log.warn(
							"Some shadcn components may not have been added. You can add them manually.",
						);
					}
				});

				// Generate GitHub workflows
				await withSpinner("Setting up GitHub workflows", async () => {
					await ensureDir(path.join(projectPath, ".github"));
					await ensureDir(path.join(projectPath, ".github", "workflows"));

					await writeFile(
						path.join(projectPath, ".github", "workflows", "checks.yml"),
						templates.generateChecksWorkflow(),
					);
					await writeFile(
						path.join(projectPath, ".github", "workflows", "test.yml"),
						templates.generateTestWorkflow(name),
					);
				});

				// Format code with Biome
				await withSpinner("Formatting code", async () => {
					await pnpmRun("format", projectPath);
				});

				// Initialize git
				await withSpinner("Initializing git repository", async () => {
					await gitInit(projectPath);
					await gitAdd(projectPath);
					await gitCommit("Initial commit from create-hatch", projectPath);
				});

				// If headless mode, run the full setup
				if (options.headless) {
					const headlessOptions: HeadlessOptions = {
						githubToken: options.githubToken,
						githubOrg: options.githubOrg,
						vercelToken: options.vercelToken,
						vercelTeam: options.vercelTeam,
						supabaseToken: options.supabaseToken,
						supabaseOrg: options.supabaseOrg,
						supabaseRegion: options.supabaseRegion,
						backendProvider: useConvex ? "convex" : "supabase",
						conflictStrategy: options.conflictStrategy,
						json: options.json,
						quiet: options.quiet,
						bootstrap: options.bootstrap,
						configPath: options.config,
					};

					const result = await runHeadlessSetup(
						name,
						projectPath,
						headlessOptions,
						useWorkOS,
					);

					outputResult(result, options.json, options.quiet);

					if (!result.success) {
						process.exit(1);
					}

					return;
				}

				// Success message (interactive mode only)
				log.blank();
				log.success(`Project "${name}" created successfully!`);
				log.blank();
				log.info("Next steps:");
				log.step(`cd ${projectPath}`);
				log.step(
					"pnpm app:setup  # Creates GitHub repo, Vercel project, and database",
				);
				log.blank();

				log.info("Required environment variables:");
				if (useWorkOS) {
					log.step("WORKOS_CLIENT_ID      # From WorkOS dashboard");
					log.step("WORKOS_API_KEY        # From WorkOS dashboard");
				} else {
					log.step("RESEND_API_KEY        # From resend.com (for email OTP)");
				}
				log.step("AI_GATEWAY_API_KEY    # From Vercel AI Gateway");
				log.blank();
			} catch (error) {
				if (options.headless && options.json) {
					console.log(
						JSON.stringify({
							success: false,
							error: error instanceof Error ? error.message : String(error),
						}),
					);
					process.exit(1);
				}
				log.error(
					`Failed to create project: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		},
	);
