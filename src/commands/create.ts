import path from "node:path";
import { Command } from "commander";
import * as templates from "../templates/index.js";
import {
	gitAdd,
	gitCommit,
	gitInit,
	pnpmDlx,
	pnpmInstall,
	pnpmRun,
} from "../utils/exec.js";
import {
	ensureDir,
	fileExists,
	setExecutable,
	writeFile,
} from "../utils/fs.js";
import { log } from "../utils/logger.js";
import { getProjectPrompts } from "../utils/prompts.js";
import { withSpinner } from "../utils/spinner.js";

export const createCommand = new Command()
	.name("create")
	.description("Create a new Hatch project")
	.argument("[project-name]", "Name of the project")
	.option("--workos", "Use WorkOS instead of Better Auth", false)
	.option("--docker", "Use local Docker PostgreSQL instead of Supabase", false)
	.option("--no-vscode", "Skip generating VS Code configuration files")
	.action(
		async (
			projectName: string | undefined,
			options: { workos: boolean; docker: boolean; vscode: boolean },
		) => {
			try {
				// Get project options
				const projectOptions = await getProjectPrompts(
					projectName,
					options.workos,
				);
				const { projectName: inputName, useWorkOS } = projectOptions;
				const includeVSCode = options.vscode;
				const useDocker = options.docker;

				const projectPath = path.resolve(process.cwd(), inputName);
				// Extract just the directory name for use in templates
				const name = path.basename(projectPath);

				// Check if directory exists
				if (await fileExists(projectPath)) {
					log.error(`Directory "${name}" already exists.`);
					process.exit(1);
				}

				log.blank();
				log.info(`Creating project "${name}"...`);
				log.info(
					`Auth provider: ${useWorkOS ? "WorkOS" : "Better Auth (Email OTP)"}`,
				);
				log.info(
					`Database: ${useDocker ? "Local Docker PostgreSQL" : "Supabase (cloud)"}`,
				);
				log.info(`VS Code config: ${includeVSCode ? "included" : "skipped"}`);
				log.blank();

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
					// Docker Compose is always generated for CI/CD and as a local fallback
					await writeFile(
						path.join(projectPath, "docker-compose.yml"),
						templates.generateDockerCompose(name),
					);
					await writeFile(
						path.join(projectPath, ".nvmrc"),
						templates.generateNvmrc(),
					);
					await writeFile(
						path.join(projectPath, ".mcp.json"),
						templates.generateMcpJson(),
					);
					await writeFile(
						path.join(projectPath, "CLAUDE.md"),
						templates.generateClaudeMd(name, useWorkOS),
					);
					await writeFile(
						path.join(projectPath, "README.md"),
						templates.generateReadme(name, useDocker),
					);
				});

				// Generate Supabase configuration (unless using Docker)
				if (!useDocker) {
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

				// Generate worktree sandbox scripts
				await withSpinner("Setting up worktree scripts", async () => {
					await ensureDir(path.join(projectPath, "scripts"));
					await ensureDir(path.join(projectPath, "scripts", "sandbox"));
					await ensureDir(path.join(projectPath, ".claude"));

					// Main scripts
					const wtsPath = path.join(projectPath, "scripts", "wts");
					const wtcsPath = path.join(projectPath, "scripts", "wtcs");
					const buildSandboxPath = path.join(
						projectPath,
						"scripts",
						"sandbox",
						"build-sandbox",
					);

					await writeFile(wtsPath, templates.generateWtsScript(useDocker));
					await writeFile(wtcsPath, templates.generateWtcsScript(useDocker));
					await writeFile(buildSandboxPath, templates.generateBuildSandbox());
					await writeFile(
						path.join(projectPath, "scripts", "sandbox", "Dockerfile"),
						templates.generateSandboxDockerfile(),
					);

					// Supabase scripts (generated unless using Docker)
					if (!useDocker) {
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
						templates.generateSetupScript(useDocker, name),
					);
					await setExecutable(setupScriptPath);

					// Config files
					await writeFile(
						path.join(projectPath, ".worktreeinclude"),
						templates.generateWorktreeInclude(),
					);
					await writeFile(
						path.join(projectPath, ".claude", "sandbox.settings.local.json"),
						templates.generateSandboxSettings(),
					);

					// Claude settings and skills
					await ensureDir(
						path.join(projectPath, ".claude", "skills", "typecheck"),
					);
					await ensureDir(path.join(projectPath, ".claude", "skills", "test"));
					await ensureDir(
						path.join(projectPath, ".claude", "skills", "db-migrate"),
					);

					await writeFile(
						path.join(projectPath, ".claude", "settings.local.json"),
						templates.generateSettingsLocal(),
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

					// Make scripts executable
					await setExecutable(wtsPath);
					await setExecutable(wtcsPath);
					await setExecutable(buildSandboxPath);
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
					await ensureDir(path.join(webPath, "app", "(app)", "dashboard"));
					await ensureDir(path.join(webPath, "app", "api", "auth", "[...all]"));
					await ensureDir(path.join(webPath, "app", "api", "chat"));
					await ensureDir(path.join(webPath, "app", "api", "workflow"));
					await ensureDir(path.join(webPath, "components", "ui"));
					await ensureDir(path.join(webPath, "components", "dashboard"));
					await ensureDir(path.join(webPath, "components", "providers"));
					await ensureDir(path.join(webPath, "lib"));
					await ensureDir(path.join(webPath, "db"));
					await ensureDir(path.join(webPath, "workflows"));

					// Generate web app files
					await writeFile(
						path.join(webPath, "package.json"),
						templates.generateWebPackageJson(useWorkOS),
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
						path.join(webPath, "components.json"),
						templates.generateComponentsJson(),
					);
					await writeFile(
						path.join(webPath, ".env.local.example"),
						templates.generateEnvExample(useWorkOS, name),
					);
					await writeFile(
						path.join(webPath, "vercel.json"),
						templates.generateVercelJson(),
					);

					// App files
					await writeFile(
						path.join(webPath, "app", "layout.tsx"),
						templates.generateRootLayout(useWorkOS),
					);
					await writeFile(
						path.join(webPath, "app", "globals.css"),
						templates.generateGlobalsCss(),
					);

					// Marketing page files
					await writeFile(
						path.join(webPath, "app", "(marketing)", "page.tsx"),
						templates.generateMarketingPage(),
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

					// App layout
					await writeFile(
						path.join(webPath, "app", "(app)", "layout.tsx"),
						templates.generateAppLayout(),
					);

					// Lib files
					await writeFile(
						path.join(webPath, "lib", "utils.ts"),
						templates.generateLibUtils(),
					);
				});

				// Generate database files
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
					} else {
						// Better Auth
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
				});

				// Generate LLM observability and evals
				await withSpinner("Setting up LLM observability", async () => {
					await ensureDir(path.join(webPath, "evals"));

					// Observed model for AI tracing
					await writeFile(
						path.join(webPath, "lib", "observed-model.ts"),
						templates.generateObservedModel(),
					);

					// Evalite configuration
					await writeFile(
						path.join(webPath, "evalite.config.ts"),
						templates.generateEvaliteConfig(),
					);

					// Evals setup file
					await writeFile(
						path.join(webPath, "evals", "setup.ts"),
						templates.generateEvalsSetup(),
					);

					// Example evals
					await writeFile(
						path.join(webPath, "evals", "chat-quality.eval.ts"),
						templates.generateChatQualityEval(),
					);
					await writeFile(
						path.join(webPath, "evals", "structured-output.eval.ts"),
						templates.generateStructuredOutputEval(),
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
						path.join(webPath, "components", "dashboard", "ai-trigger.tsx"),
						templates.generateAITriggerButton(),
					);
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
						templates.generateTestDbUtils(name, useWorkOS),
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
					await writeFile(
						path.join(webPath, "__tests__", "integration", "db.test.ts"),
						useWorkOS
							? templates.generateWorkOSDbTest(name)
							: templates.generateDbTest(name),
					);
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
				});

				// Install dependencies
				await withSpinner(
					"Installing dependencies (this may take a while)",
					async () => {
						await pnpmInstall(projectPath);
					},
				);

				// Initialize shadcn
				await withSpinner("Initializing shadcn/ui", async () => {
					try {
						await pnpmDlx(
							"shadcn@latest",
							["init", "-y", "-c", "apps/web"],
							projectPath,
						);
					} catch (error) {
						// shadcn init might fail if components.json already exists, that's ok
						log.warn("shadcn init skipped (components.json already exists)");
					}
				});

				// Add shadcn components
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
							["add", ...components, "-y", "-c", "apps/web"],
							projectPath,
						);
					} catch (error) {
						log.warn(
							"Some shadcn components may not have been added. You can add them manually.",
						);
					}
				});

				// Add clsx and tailwind-merge for the utils.ts
				await withSpinner("Adding utility dependencies", async () => {
					try {
						await pnpmDlx(
							"pnpm",
							["--filter", "web", "add", "clsx", "tailwind-merge"],
							projectPath,
						);
					} catch {
						// Ignore if it fails, might be already installed
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
					await writeFile(
						path.join(
							projectPath,
							".github",
							"workflows",
							"claude-code-review.yml",
						),
						templates.generateClaudeCodeReviewWorkflow(),
					);
					await writeFile(
						path.join(projectPath, ".github", "workflows", "claude.yml"),
						templates.generateClaudeWorkflow(),
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

				// Success message
				log.blank();
				log.success(`Project "${name}" created successfully!`);
				log.blank();
				log.info("Next steps:");
				log.step(`cd ${name}`);
				log.blank();

				log.info("Option A: Automated setup (recommended)");
				log.step(
					"pnpm setup  # Creates GitHub repo, Vercel project, and Supabase database",
				);
				log.blank();

				log.info("Option B: Manual setup");
				log.step("cp apps/web/.env.local.example apps/web/.env.local");
				log.step("# Fill in environment variables in apps/web/.env.local");

				if (useDocker) {
					log.step("pnpm docker:up");
					log.step("pnpm db:generate && pnpm db:migrate");
				} else {
					log.step(
						"# Create a Supabase project at https://supabase.com/dashboard",
					);
					log.step(
						"pnpm supabase:setup  # Link project and create dev branches",
					);
				}
				log.step("pnpm dev");
				log.blank();

				log.info("To run tests:");
				log.step("pnpm docker:up:test  # Tests always use Docker PostgreSQL");
				log.step("pnpm test");
				log.blank();

				if (!useDocker) {
					log.info("For production (Vercel):");
					log.step(
						"# Add DATABASE_URL from Supabase dashboard to Vercel env vars",
					);
					log.step("# Migrations run automatically during build");
					log.blank();
				}
			} catch (error) {
				log.error(
					`Failed to create project: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		},
	);
