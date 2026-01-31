import path from "node:path";
import type {
	HeadlessOptions,
	HeadlessResult,
	ResolvedHeadlessConfig,
} from "../types/index.js";
import { log } from "../utils/logger.js";
import { runBootstrap } from "./bootstrap.js";
import { resolveConfig, validateHeadlessOptions } from "./config.js";
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
import {
	createSupabaseBranches,
	runMigrations,
	setupSupabase,
} from "./supabase.js";
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
	useWorkOS: boolean,
	useDocker: boolean,
): Promise<HeadlessResult> {
	try {
		// Validate options
		validateHeadlessOptions(options);

		// Resolve configuration from flags, config file, and env vars
		let config: ResolvedHeadlessConfig;
		try {
			config = await resolveConfig(options);
		} catch (error) {
			return createFailureResult(error as Error);
		}

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

		// Setup Supabase (skip if using Docker)
		let supabaseResult: Awaited<ReturnType<typeof setupSupabase>> | undefined;
		if (!useDocker) {
			if (!config.quiet) {
				log.blank();
				log.info("Setting up Supabase...");
			}
			supabaseResult = await setupSupabase(projectName, projectPath, config);

			// Run migrations BEFORE creating branches
			// Branches inherit schema from main, so migrations must exist first
			if (!config.quiet) {
				log.blank();
				log.info("Running database migrations...");
			}
			await runMigrations(
				projectPath,
				supabaseResult.projectRef,
				supabaseResult.dbPassword,
				supabaseResult.region,
				config,
			);

			// Wait for migrations to be fully committed before creating branches
			// Supabase needs time to process schema changes before branching
			if (!config.quiet) {
				log.info("Waiting for schema to be ready for branching...");
			}
			await new Promise((resolve) => setTimeout(resolve, 10000));

			// Create branches AFTER migrations are run
			if (!config.quiet) {
				log.blank();
				log.info("Creating Supabase branches...");
			}
			await createSupabaseBranches(
				projectPath,
				supabaseResult.projectRef,
				config,
			);
		}

		// Setup Vercel
		if (!config.quiet) {
			log.blank();
			log.info("Setting up Vercel...");
		}

		// Use the potentially renamed project name from GitHub
		const vercelProjectName = githubResult.wasRenamed
			? githubResult.repo
			: projectName;

		let vercelResult: Awaited<ReturnType<typeof setupVercel>> | undefined;
		if (supabaseResult) {
			vercelResult = await setupVercel(
				vercelProjectName,
				projectPath,
				config,
				supabaseResult,
				useWorkOS,
			);
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
			supabase: supabaseResult
				? {
						projectRef: supabaseResult.projectRef,
						region: supabaseResult.region,
						projectName: supabaseResult.projectName,
					}
				: undefined,
			vercel: vercelResult
				? {
						url: vercelResult.url,
						projectId: vercelResult.projectId,
						projectName: vercelResult.projectName,
					}
				: undefined,
			nextSteps: generateNextSteps(
				{
					success: true,
					supabase: supabaseResult
						? {
								projectRef: supabaseResult.projectRef,
								region: supabaseResult.region,
								projectName: supabaseResult.projectName,
							}
						: undefined,
					vercel: vercelResult
						? {
								url: vercelResult.url,
								projectId: vercelResult.projectId,
								projectName: vercelResult.projectName,
							}
						: undefined,
				},
				useWorkOS,
			),
		});

		return result;
	} catch (error) {
		return createFailureResult(error as Error);
	}
}
