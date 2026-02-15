import path from "node:path";
import type {
	HeadlessOptions,
	HeadlessResult,
	ResolvedHeadlessConfig,
} from "../types/index.js";
import { log } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import { runBootstrap } from "./bootstrap.js";
import { vercelWaitForProductionUrl } from "./cli-wrappers.js";
import {
	loadConfigFile,
	resolveConfig,
	validateHeadlessOptions,
} from "./config.js";
import { setupConvex } from "./convex.js";
import { setupGitHub } from "./github.js";
import {
	createFailureResult,
	createSuccessResult,
	generateNextSteps,
	outputResult,
} from "./output.js";
import {
	checkPrerequisites,
	formatPrerequisiteResults,
} from "./prerequisites.js";
import { setupVercel } from "./vercel.js";

export { resolveConfig, validateHeadlessOptions } from "./config.js";
export { outputResult } from "./output.js";

/**
 * Run the complete headless setup flow
 */
export async function runHeadlessSetup(
	projectName: string,
	projectPath: string,
	options: HeadlessOptions,
): Promise<HeadlessResult> {
	try {
		// Validate options
		validateHeadlessOptions(options);

		// Resolve configuration from flags, config file, and env vars
		let config: ResolvedHeadlessConfig;
		const hatchConfig = await loadConfigFile(options.configPath);
		try {
			config = await resolveConfig(options);
		} catch (error) {
			return createFailureResult(error as Error);
		}

		// Load custom env vars from config file
		const customEnvVars = hatchConfig?.envVars;

		// Run bootstrap if requested
		if (options.bootstrap) {
			if (!config.quiet) {
				log.info("Running bootstrap...");
			}
			try {
				await runBootstrap(config, config.quiet);
			} catch (error) {
				return createFailureResult(
					`Bootstrap failed: ${(error as Error).message}`,
				);
			}
		}

		// Check prerequisites
		const prereqResult = await checkPrerequisites(config);
		if (!prereqResult.passed) {
			return createFailureResult(
				`Prerequisites not met:\n${formatPrerequisiteResults(prereqResult)}`,
			);
		}

		// Setup GitHub
		if (!config.quiet) {
			log.blank();
			log.info("Setting up GitHub...");
		}
		const githubResult = await setupGitHub(projectName, projectPath, config);

		// Setup Convex
		if (!config.quiet) {
			log.blank();
			log.info("Setting up Convex...");
		}
		const convexResult = await setupConvex(
			projectName,
			projectPath,
			config,
			config.quiet,
			customEnvVars,
		);

		// Setup Vercel
		if (!config.quiet) {
			log.blank();
			log.info("Setting up Vercel...");
		}

		// Use the potentially renamed project name from GitHub
		const vercelProjectName = githubResult.wasRenamed
			? githubResult.repo
			: projectName;

		const vercelResult = await setupVercel(
			vercelProjectName,
			projectPath,
			config,
			convexResult,
			customEnvVars,
		);

		// Commit setup changes and push to trigger deployment
		// This includes .vercel config and .env.local
		if (!config.quiet) {
			log.blank();
			log.info("Deploying to production...");
		}
		try {
			const { execa } = await import("execa");

			// Check if there are changes to commit
			const statusResult = await execa("git", ["status", "--porcelain"], {
				cwd: projectPath,
			});

			if (statusResult.stdout.trim()) {
				// Commit setup changes
				await execa("git", ["add", "-A"], { cwd: projectPath });
				await execa(
					"git",
					[
						"commit",
						"-m",
						"chore: configure project setup\n\n- Add Vercel project configuration\n- Configure environment files",
					],
					{ cwd: projectPath },
				);

				// Push with GITHUB_TOKEN authentication
				// GH_TOKEN/GITHUB_TOKEN is used by git credential helper
				const env = config.github.token
					? {
							...process.env,
							GITHUB_TOKEN: config.github.token,
							GH_TOKEN: config.github.token,
						}
					: process.env;

				if (!config.quiet) {
					await withSpinner("Pushing to trigger deployment", async () => {
						// Use git push with credential helper that reads from env
						await execa(
							"git",
							[
								"-c",
								"credential.helper=!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f",
								"push",
								"origin",
								"main",
							],
							{
								cwd: projectPath,
								env,
							},
						);
					});
				} else {
					await execa(
						"git",
						[
							"-c",
							"credential.helper=!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f",
							"push",
							"origin",
							"main",
						],
						{
							cwd: projectPath,
							env,
						},
					);
				}
			} else {
				if (!config.quiet) {
					log.info("No setup changes to commit - deployment already triggered");
				}
			}
		} catch (error) {
			if (!config.quiet) {
				log.warn(
					"Could not push setup changes - deploy manually with: git push origin main",
				);
			}
		}

		// Wait for Vercel deployment to complete and get the real URL
		if (vercelResult) {
			if (!config.quiet) {
				log.blank();
				const realUrl = await withSpinner(
					"Waiting for Vercel deployment to complete",
					async () => {
						return vercelWaitForProductionUrl({
							projectId: vercelResult.projectId,
							projectName: vercelResult.projectName,
							token: config.vercel.token,
						});
					},
				);
				vercelResult.url = realUrl;
			} else {
				vercelResult.url = await vercelWaitForProductionUrl({
					projectId: vercelResult.projectId,
					projectName: vercelResult.projectName,
					token: config.vercel.token,
				});
			}
		}

		// Generate result
		const result = createSuccessResult({
			project: {
				name: githubResult.wasRenamed ? githubResult.repo : projectName,
				path: projectPath,
			},
			github: {
				url: githubResult.url,
				owner: githubResult.owner,
				repo: githubResult.repo,
			},
			convex: {
				deploymentUrl: convexResult.deploymentUrl,
				projectSlug: convexResult.projectSlug,
				deployKey: convexResult.deployKey,
				deploymentName: convexResult.deploymentName,
			},
			vercel: vercelResult
				? {
						url: vercelResult.url,
						projectId: vercelResult.projectId,
						projectName: vercelResult.projectName,
					}
				: undefined,
			nextSteps: generateNextSteps({
				success: true,
				convex: {
					deploymentUrl: convexResult.deploymentUrl,
					projectSlug: convexResult.projectSlug,
					deployKey: convexResult.deployKey,
					deploymentName: convexResult.deploymentName,
				},
				vercel: vercelResult
					? {
							url: vercelResult.url,
							projectId: vercelResult.projectId,
							projectName: vercelResult.projectName,
						}
					: undefined,
			}),
		});

		return result;
	} catch (error) {
		return createFailureResult(error as Error);
	}
}
