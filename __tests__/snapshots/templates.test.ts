import { describe, expect, it } from "vitest";
import * as templates from "../../src/templates/index.js";

describe("template snapshots", () => {
	describe("root templates", () => {
		it("generateRootPackageJson", () => {
			expect(templates.generateRootPackageJson("test-app")).toMatchSnapshot();
		});

		it("generateTurboJson", () => {
			expect(templates.generateTurboJson()).toMatchSnapshot();
		});

		it("generatePnpmWorkspace", () => {
			expect(templates.generatePnpmWorkspace()).toMatchSnapshot();
		});

		it("generateBiomeJson", () => {
			expect(templates.generateBiomeJson()).toMatchSnapshot();
		});

		it("generateGitignore", () => {
			expect(templates.generateGitignore()).toMatchSnapshot();
		});

		it("generateNvmrc", () => {
			expect(templates.generateNvmrc()).toMatchSnapshot();
		});

		it("generateMcpJson", () => {
			expect(templates.generateMcpJson()).toMatchSnapshot();
		});

		it("generateClaudeMd", () => {
			expect(templates.generateClaudeMd("test-app")).toMatchSnapshot();
		});

		it("generateReadme", () => {
			expect(templates.generateReadme("test-app")).toMatchSnapshot();
		});
	});

	describe("web templates", () => {
		it("generateWebPackageJson (Better Auth)", () => {
			expect(templates.generateWebPackageJson(false)).toMatchSnapshot();
		});

		it("generateWebPackageJson (WorkOS)", () => {
			expect(templates.generateWebPackageJson(true)).toMatchSnapshot();
		});

		it("generateNextConfig", () => {
			expect(templates.generateNextConfig()).toMatchSnapshot();
		});

		it("generateWebTsconfig", () => {
			expect(templates.generateWebTsconfig()).toMatchSnapshot();
		});

		it("generateRootLayout", () => {
			expect(templates.generateRootLayout()).toMatchSnapshot();
		});

		it("generateHomePage", () => {
			expect(templates.generateHomePage()).toMatchSnapshot();
		});

		it("generateGlobalsCss", () => {
			expect(templates.generateGlobalsCss()).toMatchSnapshot();
		});

		it("generateTailwindConfig", () => {
			expect(templates.generateTailwindConfig()).toMatchSnapshot();
		});

		it("generatePostcssConfig", () => {
			expect(templates.generatePostcssConfig()).toMatchSnapshot();
		});

		it("generateEnvExample", () => {
			expect(templates.generateEnvExample()).toMatchSnapshot();
		});
	});

	describe("database templates", () => {
		it("generateDbIndex", () => {
			expect(templates.generateDbIndex()).toMatchSnapshot();
		});

		it("generateDbSchema (Better Auth)", () => {
			expect(templates.generateDbSchema(false)).toMatchSnapshot();
		});

		it("generateDbSchema (WorkOS)", () => {
			expect(templates.generateDbSchema(true)).toMatchSnapshot();
		});

		it("generateBetterAuthSchema", () => {
			expect(templates.generateBetterAuthSchema()).toMatchSnapshot();
		});

		it("generateWorkOSSchema", () => {
			expect(templates.generateWorkOSSchema()).toMatchSnapshot();
		});

		it("generateDrizzleConfig", () => {
			expect(templates.generateDrizzleConfig()).toMatchSnapshot();
		});
	});

	describe("auth templates - Better Auth", () => {
		it("generateBetterAuthConfig", () => {
			expect(templates.generateBetterAuthConfig()).toMatchSnapshot();
		});

		it("generateBetterAuthClient", () => {
			expect(templates.generateBetterAuthClient()).toMatchSnapshot();
		});

		it("generateBetterAuthRouteHandler", () => {
			expect(templates.generateBetterAuthRouteHandler()).toMatchSnapshot();
		});

		it("generateLoginPage", () => {
			expect(templates.generateLoginPage()).toMatchSnapshot();
		});

		it("generateVerifyOTPPage", () => {
			expect(templates.generateVerifyOTPPage()).toMatchSnapshot();
		});

		it("generateBetterAuthProxy", () => {
			expect(templates.generateBetterAuthProxy()).toMatchSnapshot();
		});

		it("generateAuthSkeleton", () => {
			expect(templates.generateAuthSkeleton()).toMatchSnapshot();
		});
	});

	describe("auth templates - WorkOS", () => {
		it("generateWorkOSCallback", () => {
			expect(templates.generateWorkOSCallback()).toMatchSnapshot();
		});

		it("generateWorkOSProxy", () => {
			expect(templates.generateWorkOSProxy()).toMatchSnapshot();
		});

		it("generateWorkOSLoginPage", () => {
			expect(templates.generateWorkOSLoginPage()).toMatchSnapshot();
		});
	});

	describe("AI templates", () => {
		it("generateChatRoute", () => {
			expect(templates.generateChatRoute()).toMatchSnapshot();
		});
	});

	describe("analytics templates", () => {
		it("generatePostHogProvider", () => {
			expect(templates.generatePostHogProvider()).toMatchSnapshot();
		});

		it("generatePostHogServer", () => {
			expect(templates.generatePostHogServer()).toMatchSnapshot();
		});
	});

	describe("workflow templates", () => {
		it("generateExampleWorkflow", () => {
			expect(templates.generateExampleWorkflow()).toMatchSnapshot();
		});

		it("generateWorkflowRoute", () => {
			expect(templates.generateWorkflowRoute()).toMatchSnapshot();
		});

		it("generateWorkflowProgressTypes", () => {
			expect(templates.generateWorkflowProgressTypes()).toMatchSnapshot();
		});

		it("generateWorkflowProgressRoute (Better Auth)", () => {
			expect(
				templates.generateWorkflowProgressRoute({ useWorkOS: false }),
			).toMatchSnapshot();
		});

		it("generateWorkflowProgressRoute (WorkOS)", () => {
			expect(
				templates.generateWorkflowProgressRoute({ useWorkOS: true }),
			).toMatchSnapshot();
		});
	});

	describe("hooks templates", () => {
		it("generateUseWorkflowProgress", () => {
			expect(templates.generateUseWorkflowProgress()).toMatchSnapshot();
		});

		it("generateUseLatest", () => {
			expect(templates.generateUseLatest()).toMatchSnapshot();
		});
	});

	describe("dashboard templates", () => {
		it("generateDashboardPage (Better Auth)", () => {
			expect(templates.generateDashboardPage(false)).toMatchSnapshot();
		});

		it("generateDashboardPage (WorkOS)", () => {
			expect(templates.generateDashboardPage(true)).toMatchSnapshot();
		});

		it("generateAITriggerButton", () => {
			expect(templates.generateAITriggerButton()).toMatchSnapshot();
		});

		it("generateDashboardActions", () => {
			expect(templates.generateDashboardActions()).toMatchSnapshot();
		});

		it("generateSignOutButton", () => {
			expect(templates.generateSignOutButton()).toMatchSnapshot();
		});

		it("generateDashboardSkeleton", () => {
			expect(templates.generateDashboardSkeleton()).toMatchSnapshot();
		});
	});

	describe("marketing templates", () => {
		it("generateMarketingPage", () => {
			expect(templates.generateMarketingPage()).toMatchSnapshot();
		});

		it("generateHero", () => {
			expect(templates.generateHero()).toMatchSnapshot();
		});

		it("generateFooter", () => {
			expect(templates.generateFooter()).toMatchSnapshot();
		});
	});

	describe("app templates", () => {
		it("generateAppLayout", () => {
			expect(templates.generateAppLayout()).toMatchSnapshot();
		});
	});

	describe("UI package templates", () => {
		it("generateUIPackageJson", () => {
			expect(templates.generateUIPackageJson()).toMatchSnapshot();
		});

		it("generateUITsconfig", () => {
			expect(templates.generateUITsconfig()).toMatchSnapshot();
		});

		it("generateUIIndex", () => {
			expect(templates.generateUIIndex()).toMatchSnapshot();
		});

		it("generateUIComponentsJson", () => {
			expect(templates.generateUIComponentsJson()).toMatchSnapshot();
		});

		it("generateUILibUtils", () => {
			expect(templates.generateUILibUtils()).toMatchSnapshot();
		});
	});

	describe("docker templates", () => {
		it("generateDockerCompose", () => {
			expect(templates.generateDockerCompose()).toMatchSnapshot();
		});
	});

	describe("test templates", () => {
		it("generateVitestConfig", () => {
			expect(templates.generateVitestConfig()).toMatchSnapshot();
		});

		it("generateVitestSetup", () => {
			expect(templates.generateVitestSetup()).toMatchSnapshot();
		});

		it("generateTestDbUtils", () => {
			expect(templates.generateTestDbUtils()).toMatchSnapshot();
		});

		it("generateTestMocks", () => {
			expect(templates.generateTestMocks()).toMatchSnapshot();
		});

		it("generateTestRenderUtils", () => {
			expect(templates.generateTestRenderUtils()).toMatchSnapshot();
		});

		it("generateUtilsTest", () => {
			expect(templates.generateUtilsTest()).toMatchSnapshot();
		});

		it("generateAiTriggerTest", () => {
			expect(templates.generateAiTriggerTest()).toMatchSnapshot();
		});

		it("generateDbTest", () => {
			expect(templates.generateDbTest()).toMatchSnapshot();
		});

		it("generateUserFactory", () => {
			expect(templates.generateUserFactory()).toMatchSnapshot();
		});
	});

	describe("test factories templates", () => {
		it("generateFactoriesIndex (Better Auth)", () => {
			expect(templates.generateFactoriesIndex(false)).toMatchSnapshot();
		});

		it("generateFactoriesIndex (WorkOS)", () => {
			expect(templates.generateFactoriesIndex(true)).toMatchSnapshot();
		});

		it("generateWorkOSDbTest", () => {
			expect(templates.generateWorkOSDbTest()).toMatchSnapshot();
		});

		it("generateOrganizationFactory", () => {
			expect(templates.generateOrganizationFactory()).toMatchSnapshot();
		});
	});

	describe("scripts templates", () => {
		it("generateWtsScript", () => {
			expect(templates.generateWtsScript()).toMatchSnapshot();
		});

		it("generateWtcsScript", () => {
			expect(templates.generateWtcsScript()).toMatchSnapshot();
		});

		it("generateSandboxDockerfile", () => {
			expect(templates.generateSandboxDockerfile()).toMatchSnapshot();
		});

		it("generateBuildSandbox", () => {
			expect(templates.generateBuildSandbox()).toMatchSnapshot();
		});

		it("generateWorktreeInclude", () => {
			expect(templates.generateWorktreeInclude()).toMatchSnapshot();
		});

		it("generateSandboxSettings", () => {
			expect(templates.generateSandboxSettings()).toMatchSnapshot();
		});
	});

	describe("lib templates", () => {
		it("generateSafeAction", () => {
			expect(templates.generateSafeAction()).toMatchSnapshot();
		});

		it("generateServerLogger", () => {
			expect(templates.generateServerLogger()).toMatchSnapshot();
		});

		it("generateClientLogger", () => {
			expect(templates.generateClientLogger()).toMatchSnapshot();
		});
	});

	describe("services templates", () => {
		it("generateUserService", () => {
			expect(templates.generateUserService()).toMatchSnapshot();
		});

		it("generateServicesIndex", () => {
			expect(templates.generateServicesIndex()).toMatchSnapshot();
		});
	});

	describe("GitHub workflow templates", () => {
		it("generateChecksWorkflow", () => {
			expect(templates.generateChecksWorkflow()).toMatchSnapshot();
		});

		it("generateTestWorkflow", () => {
			expect(templates.generateTestWorkflow()).toMatchSnapshot();
		});

		it("generateClaudeCodeReviewWorkflow", () => {
			expect(templates.generateClaudeCodeReviewWorkflow()).toMatchSnapshot();
		});

		it("generateClaudeWorkflow", () => {
			expect(templates.generateClaudeWorkflow()).toMatchSnapshot();
		});
	});

	describe("VS Code templates", () => {
		it("generateVSCodeExtensions", () => {
			expect(templates.generateVSCodeExtensions()).toMatchSnapshot();
		});

		it("generateVSCodeSettings", () => {
			expect(templates.generateVSCodeSettings()).toMatchSnapshot();
		});
	});

	describe("Claude templates", () => {
		it("generateSettingsLocal", () => {
			expect(templates.generateSettingsLocal()).toMatchSnapshot();
		});

		it("generateTypecheckSkill", () => {
			expect(templates.generateTypecheckSkill()).toMatchSnapshot();
		});

		it("generateTestSkill", () => {
			expect(templates.generateTestSkill()).toMatchSnapshot();
		});

		it("generateDbMigrateSkill", () => {
			expect(templates.generateDbMigrateSkill()).toMatchSnapshot();
		});
	});

	describe("Supabase templates", () => {
		it("generateSupabaseConfig", () => {
			expect(templates.generateSupabaseConfig()).toMatchSnapshot();
		});

		it("generateSupabaseSeedSql", () => {
			expect(templates.generateSupabaseSeedSql()).toMatchSnapshot();
		});

		it("generateSupabaseSetupScript", () => {
			expect(templates.generateSupabaseSetupScript()).toMatchSnapshot();
		});

		it("generateSupabaseBranchScript", () => {
			expect(templates.generateSupabaseBranchScript()).toMatchSnapshot();
		});

		it("generateSupabaseEnvScript", () => {
			expect(templates.generateSupabaseEnvScript()).toMatchSnapshot();
		});
	});

	describe("setup templates", () => {
		it("generateSetupScript", () => {
			expect(templates.generateSetupScript()).toMatchSnapshot();
		});
	});
});
