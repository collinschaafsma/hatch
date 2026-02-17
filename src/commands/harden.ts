import { readFileSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { log } from "../utils/logger.js";
import { getProject } from "../utils/project-store.js";
import { createSpinner } from "../utils/spinner.js";

interface HardenOptions {
	project?: string;
	branch: string;
	dryRun: boolean;
	strict: boolean;
}

export interface ApplyBranchProtectionOptions {
	owner: string;
	repo: string;
	branch: string;
	harnessPath: string;
	strict: boolean;
	dryRun: boolean;
	quiet: boolean;
	token?: string;
}

function parseGitRemote(): { owner: string; repo: string } | null {
	try {
		const { execSync } = require("node:child_process");
		const url = execSync("git remote get-url origin", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();

		// Handle SSH: git@github.com:owner/repo.git
		const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+)/);
		if (sshMatch) {
			return { owner: sshMatch[1], repo: sshMatch[2] };
		}

		// Handle HTTPS: https://github.com/owner/repo.git
		const httpsMatch = url.match(/https:\/\/github\.com\/([^/]+)\/([^/.]+)/);
		if (httpsMatch) {
			return { owner: httpsMatch[1], repo: httpsMatch[2] };
		}

		return null;
	} catch {
		return null;
	}
}

async function getGitHubToken(): Promise<string | null> {
	// 1. Check env vars
	const envToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
	if (envToken) return envToken;

	// 2. Try gh auth token
	try {
		const { execa } = await import("execa");
		const result = await execa("gh", ["auth", "token"], {
			stdio: ["pipe", "pipe", "pipe"],
		});
		if (result.stdout.trim()) return result.stdout.trim();
	} catch {
		// gh CLI not available or not authenticated
	}

	return null;
}

function buildProtectionPayload(
	harnessPath: string,
	strict: boolean,
): {
	protection: Record<string, unknown>;
	requiredChecks: string[];
	requiresHumanReview: boolean;
} {
	const harness = JSON.parse(
		readFileSync(path.join(harnessPath, "harness.json"), "utf-8"),
	);

	const mergePolicy = (harness as { mergePolicy?: Record<string, unknown> })
		.mergePolicy as
		| Record<
				string,
				{
					requiredChecks?: string[];
					requiresHumanReview?: boolean;
				}
		  >
		| undefined;
	const highPolicy = mergePolicy?.high;

	if (!highPolicy) {
		throw new Error("No mergePolicy.high found in harness.json.");
	}

	const requiredChecks = highPolicy.requiredChecks || [];
	const requiresHumanReview = highPolicy.requiresHumanReview || false;

	const protection: Record<string, unknown> = {
		required_status_checks: {
			strict: true,
			contexts: requiredChecks,
		},
		enforce_admins: strict,
		restrictions: null,
		required_pull_request_reviews: requiresHumanReview
			? {
					required_approving_review_count: 1,
					dismiss_stale_reviews: true,
				}
			: null,
	};

	return { protection, requiredChecks, requiresHumanReview };
}

/**
 * Apply branch protection rules programmatically.
 * Used by both the CLI command and auto-harden during project creation.
 */
export async function applyBranchProtection(
	options: ApplyBranchProtectionOptions,
): Promise<void> {
	const {
		owner,
		repo,
		branch,
		harnessPath,
		strict,
		dryRun,
		quiet,
		token: providedToken,
	} = options;

	const { protection } = buildProtectionPayload(harnessPath, strict);

	if (dryRun) return;

	const token = providedToken || (await getGitHubToken());
	if (!token) {
		throw new Error("GitHub token not found");
	}

	const spinner = quiet
		? null
		: createSpinner("Applying branch protection rules").start();

	try {
		const { execa } = await import("execa");
		await execa(
			"gh",
			[
				"api",
				"-X",
				"PUT",
				`/repos/${owner}/${repo}/branches/${branch}/protection`,
				"--input",
				"-",
			],
			{
				input: JSON.stringify(protection),
				env: {
					...process.env,
					...(token ? { GH_TOKEN: token } : {}),
				},
			},
		);

		if (spinner) spinner.succeed("Branch protection applied successfully");
	} catch (error) {
		if (spinner) spinner.fail("Failed to apply branch protection");
		throw error;
	}
}

export const hardenCommand = new Command()
	.name("harden")
	.description(
		"Apply GitHub branch protection rules from harness.json merge policy",
	)
	.option("--project <name>", "Look up repo from project store")
	.option("--branch <branch>", "Branch to protect", "main")
	.option("--dry-run", "Show what would be configured without applying", false)
	.option(
		"--strict",
		"Enforce on admins too (team mode — admins cannot bypass)",
		false,
	)
	.action(async (options: HardenOptions) => {
		try {
			log.blank();

			// 1. Read harness.json (validate it exists)
			let harness: Record<string, unknown>;
			try {
				harness = JSON.parse(
					readFileSync(path.join(process.cwd(), "harness.json"), "utf-8"),
				);
			} catch {
				log.error("Could not read harness.json in current directory.");
				log.info(
					"Run this command from a project root that has a harness.json file.",
				);
				process.exit(1);
			}

			// 2. Detect owner/repo
			let owner: string | undefined;
			let repo: string | undefined;

			if (options.project) {
				const project = await getProject(options.project);
				if (!project) {
					log.error(`Project not found: ${options.project}`);
					log.info("Run 'hatch list --projects' to see available projects.");
					process.exit(1);
				}
				owner = project.github.owner;
				repo = project.github.repo;
			} else {
				const remote = parseGitRemote();
				if (!remote) {
					log.error("Could not detect GitHub owner/repo from git remote.");
					log.info(
						"Use --project <name> to specify a project, or run from a git repo with a GitHub remote.",
					);
					process.exit(1);
				}
				owner = remote.owner;
				repo = remote.repo;
			}

			// 3. Get GitHub token
			const token = await getGitHubToken();
			if (!token && !options.dryRun) {
				log.error("GitHub token not found.");
				log.info(
					"Set GH_TOKEN or GITHUB_TOKEN env var, or authenticate with: gh auth login",
				);
				process.exit(1);
			}

			// 4. Build protection payload for display
			const { protection, requiredChecks, requiresHumanReview } =
				buildProtectionPayload(process.cwd(), options.strict);

			// 5. Show summary
			log.info(`Repository: ${owner}/${repo}`);
			log.info(`Branch: ${options.branch}`);
			log.info(
				`Strict mode: ${options.strict ? "yes (admins enforced)" : "no (admins can bypass)"}`,
			);
			log.blank();

			log.info("Branch protection configuration:");
			log.step(
				`Required status checks: ${requiredChecks.length > 0 ? requiredChecks.join(", ") : "(none)"}`,
			);
			log.step("Strict status checks: yes");
			if (requiresHumanReview) {
				log.step("Required reviews: 1 (dismiss stale reviews)");
			} else {
				log.step("Required reviews: none");
			}
			log.step(`Enforce on admins: ${options.strict ? "yes" : "no"}`);

			if (options.dryRun) {
				log.blank();
				log.info("Dry run — no changes applied.");
				log.blank();
				log.info("Payload:");
				console.log(JSON.stringify(protection, null, 2));
				process.exit(0);
			}

			// 6. Apply
			log.blank();
			await applyBranchProtection({
				owner: owner as string,
				repo: repo as string,
				branch: options.branch,
				harnessPath: process.cwd(),
				strict: options.strict,
				dryRun: false,
				quiet: false,
				token: token ?? undefined,
			});

			// 7. Print success summary
			log.blank();
			log.success(
				`Branch protection configured for ${owner}/${repo}:${options.branch}`,
			);
			if (!options.strict) {
				log.info(
					"Note: Admins can bypass checks and self-approve (solo-friendly default).",
				);
				log.info(
					"Use --strict to enforce on admins too (recommended for teams).",
				);
			}
			log.blank();
		} catch (error) {
			log.blank();
			log.error(
				`Failed to harden branch: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
