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

		it("generateComponentsJson", () => {
			expect(templates.generateComponentsJson()).toMatchSnapshot();
		});

		it("generateLibUtils", () => {
			expect(templates.generateLibUtils()).toMatchSnapshot();
		});

		it("generateEnvExample", () => {
			expect(templates.generateEnvExample()).toMatchSnapshot();
		});
	});

	describe("database templates", () => {
		it("generateDbIndex", () => {
			expect(templates.generateDbIndex()).toMatchSnapshot();
		});

		it("generateDbSchema", () => {
			expect(templates.generateDbSchema()).toMatchSnapshot();
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

		it("generateObservedModel", () => {
			expect(templates.generateObservedModel()).toMatchSnapshot();
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

		it("generateFactoriesIndex", () => {
			expect(templates.generateFactoriesIndex()).toMatchSnapshot();
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

	describe("evals templates", () => {
		it("generateEvaliteConfig", () => {
			expect(templates.generateEvaliteConfig()).toMatchSnapshot();
		});

		it("generateEvalsSetup", () => {
			expect(templates.generateEvalsSetup()).toMatchSnapshot();
		});

		it("generateChatQualityEval", () => {
			expect(templates.generateChatQualityEval()).toMatchSnapshot();
		});

		it("generateStructuredOutputEval", () => {
			expect(templates.generateStructuredOutputEval()).toMatchSnapshot();
		});
	});
});
