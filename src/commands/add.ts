import path from "node:path";
import { confirm, input } from "@inquirer/prompts";
import { Command } from "commander";
import { execa } from "execa";
import fs from "fs-extra";
import { vercelGetProjectUrl } from "../headless/cli-wrappers.js";
import type { HatchConfig, ProjectRecord } from "../types/index.js";
import {
	getProjectConfigPath,
	resolveConfigPath,
} from "../utils/config-resolver.js";
import {
	gitAdd,
	gitCheckout,
	gitCommit,
	gitPull,
	gitPush,
} from "../utils/exec.js";
import {
	mergeHarnessPackageJsonScripts,
	scaffoldHarness,
} from "../utils/harness-scaffold.js";
import { log } from "../utils/logger.js";
import { getProject, saveProject } from "../utils/project-store.js";
import { createSpinner } from "../utils/spinner.js";

interface AddOptions {
	config?: string;
	path?: string;
}

interface GitHubRepo {
	url: string;
	owner: { login: string };
	name: string;
}

export const addCommand = new Command()
	.name("add")
	.description(
		"Add an existing project to Hatch: scaffolds harness, commits, pushes, and opens a PR",
	)
	.argument("<project-name>", "Project name (matches repo name)")
	.option("-c, --config <path>", "Path to hatch.json config file")
	.option("--path <path>", "Path to an existing local checkout of the project")
	.action(async (projectName: string, options: AddOptions) => {
		try {
			log.blank();
			log.info(`Adding existing project: ${projectName}`);
			log.blank();

			// Check if project already exists
			const existing = await getProject(projectName);
			if (existing) {
				log.error(`Project "${projectName}" already exists in the store.`);
				log.info("Run 'hatch list --projects' to see stored projects.");
				process.exit(1);
			}

			// Resolve config path (auto-detects per-project config)
			const configPath = await resolveConfigPath({
				configPath: options.config,
				project: projectName,
			});
			let config: HatchConfig = { convex: {} };
			const perProjectConfigPath = await getProjectConfigPath(projectName);
			const usedPerProjectConfig = configPath === perProjectConfigPath;
			if (await fs.pathExists(configPath)) {
				config = await fs.readJson(configPath);
				if (usedPerProjectConfig) {
					log.step(
						`Using per-project config: ~/.hatch/configs/${projectName}.json`,
					);
				}
			}

			const githubOrg = config.github?.org;
			const vercelTeam = config.vercel?.team;

			// Step 1: Look up GitHub repo
			const githubSpinner = createSpinner("Looking up GitHub repo").start();
			let github: ProjectRecord["github"] | undefined;

			try {
				// If --path is provided, run gh from the local checkout to read its remote
				const ghArgs = options.path
					? ["repo", "view", "--json", "url,owner,name"]
					: [
							"repo",
							"view",
							githubOrg ? `${githubOrg}/${projectName}` : projectName,
							"--json",
							"url,owner,name",
						];
				const ghOptions = options.path
					? { cwd: path.resolve(options.path) }
					: {};
				const { stdout } = await execa("gh", ghArgs, ghOptions);
				const repo = JSON.parse(stdout) as GitHubRepo;
				github = {
					url: repo.url,
					owner: repo.owner.login,
					repo: repo.name,
				};
				githubSpinner.succeed(`Found GitHub repo: ${repo.url}`);
			} catch {
				githubSpinner.warn("GitHub repo not found automatically");
				const url = await input({
					message: "GitHub repo URL (or press Enter to skip):",
				});
				if (url) {
					const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
					if (match) {
						github = {
							url: url.replace(/\.git$/, ""),
							owner: match[1],
							repo: match[2],
						};
					}
				}
			}

			if (!github) {
				log.error("GitHub repo is required.");
				process.exit(1);
			}

			// Step 2: Look up Vercel project
			const vercelSpinner = createSpinner("Looking up Vercel project").start();
			let vercel: ProjectRecord["vercel"] | undefined;

			try {
				const inspectArgs = ["project", "inspect", projectName];
				if (vercelTeam) {
					inspectArgs.push("--scope", vercelTeam);
				}
				if (config.vercel?.token) {
					inspectArgs.push("--token", config.vercel.token);
				}

				const { stdout, stderr } = await execa("vercel", inspectArgs);
				const detail = stdout || stderr;
				const idMatch = detail.match(/\bID\s+(prj_\S+)/);
				if (idMatch) {
					const result = await vercelGetProjectUrl({
						projectId: idMatch[1],
						projectName,
						token: config.vercel?.token,
					});
					vercel = {
						projectId: idMatch[1],
						url: result.url,
					};
					vercelSpinner.succeed(`Found Vercel project: ${projectName}`);
				} else {
					vercelSpinner.warn("Could not parse Vercel project ID");
				}
			} catch {
				vercelSpinner.warn("Vercel project not found automatically");
			}

			if (!vercel) {
				const id = await input({
					message: "Vercel project ID (or press Enter to skip):",
				});
				if (id) {
					const url = await input({
						message: "Vercel project URL:",
						default: `https://${projectName}.vercel.app`,
					});
					vercel = { projectId: id, url };
				}
			}

			if (!vercel) {
				log.error("Vercel project is required.");
				process.exit(1);
			}

			// Step 3: Save project record
			const projectRecord: ProjectRecord = {
				name: projectName,
				createdAt: new Date().toISOString(),
				github,
				vercel,
			};

			await saveProject(projectRecord);

			// Step 4: Create per-project config if one wasn't already used
			if (!usedPerProjectConfig) {
				log.blank();
				const createConfig = await confirm({
					message: `Create a per-project config for "${projectName}"?`,
					default: true,
				});

				if (createConfig) {
					const newConfigPath = await getProjectConfigPath(projectName);
					const projectConfig: HatchConfig = {
						project: projectName,
						convex: {
							accessToken: config.convex?.accessToken,
						},
					};
					if (config.github?.token || config.github?.org) {
						projectConfig.github = {
							token: config.github?.token,
							org: config.github?.org,
							email: config.github?.email,
							name: config.github?.name,
						};
					}
					if (config.vercel?.token || config.vercel?.team) {
						projectConfig.vercel = {
							token: config.vercel?.token,
							team: config.vercel?.team,
						};
					}
					if (config.anthropicApiKey) {
						projectConfig.anthropicApiKey = config.anthropicApiKey;
					}

					await fs.writeJson(newConfigPath, projectConfig, {
						spaces: 2,
					});
					log.success(`Per-project config written to ${newConfigPath}`);
				}
			}

			// Step 5: Resolve project directory
			let projectPath: string;

			if (options.path) {
				projectPath = path.resolve(options.path);
				if (!(await fs.pathExists(path.join(projectPath, ".git")))) {
					log.error(
						`${projectPath} is not a git repository. Provide a path to a git checkout.`,
					);
					process.exit(1);
				}
				log.step(`Using existing checkout: ${projectPath}`);
			} else {
				const cloneSpinner = createSpinner("Cloning repository").start();
				try {
					const { cloneProject } = await import("./clone.js");
					const cloneResult = await cloneProject(projectName, {
						configPath,
					});
					projectPath = cloneResult.path;
					cloneSpinner.succeed(`Cloned to ${projectPath}`);
				} catch (err) {
					cloneSpinner.fail("Failed to clone repository");
					log.error(
						`Could not clone repo: ${err instanceof Error ? err.message : err}`,
					);
					log.info(
						"Use --path to point to an existing local checkout instead.",
					);
					process.exit(1);
				}
			}

			// Step 6: Create add-hatch branch
			const branchSpinner = createSpinner("Creating add-hatch branch").start();
			try {
				await gitCheckout(projectPath, "main");
				await gitPull(projectPath, config.github?.token);
			} catch {
				// May already be on main or remote may not be configured
			}
			try {
				await gitCheckout(projectPath, "add-hatch", true);
			} catch {
				// Branch already exists (previous run) — reset it to current HEAD
				await execa("git", ["branch", "-D", "add-hatch"], {
					cwd: projectPath,
				});
				await gitCheckout(projectPath, "add-hatch", true);
			}
			branchSpinner.succeed("Created branch: add-hatch");

			// Step 7: Scaffold harness
			const harnessSpinner = createSpinner("Scaffolding agent harness").start();
			const coreResult = await scaffoldHarness({
				projectPath,
				projectName,
				skipExisting: true,
				includeDocs: true,
			});
			harnessSpinner.succeed("Agent harness scaffolded");

			// Merge harness scripts into package.json
			const pkgPath = path.join(projectPath, "package.json");
			const scriptsAdded = await mergeHarnessPackageJsonScripts(pkgPath);
			if (scriptsAdded) {
				log.step("Added harness scripts to package.json");
			}

			// Prepend harness context to CLAUDE.md if it exists
			const claudeMdPath = path.join(projectPath, "CLAUDE.md");
			if (await fs.pathExists(claudeMdPath)) {
				const existing = await fs.readFile(claudeMdPath, "utf-8");
				const harnessBlock = [
					"## Harness",
					"",
					"> Agent-agnostic instructions live in AGENTS.md. This file adds Claude Code-specific overlays.",
					"",
					"### Commands",
					"- `pnpm harness:pre-pr` - Run before opening a PR",
					"- `pnpm harness:risk-tier` - Check risk tier of current changes",
					"- `pnpm harness:docs-drift` - Check for documentation drift",
					"",
				].join("\n");
				await fs.writeFile(claudeMdPath, `${harnessBlock}\n${existing}`);
				log.step("Added harness context to CLAUDE.md");
			}

			// Show written/skipped files
			if (coreResult.written.length > 0) {
				log.blank();
				log.info("Harness files written:");
				for (const f of coreResult.written) {
					log.step(f);
				}
			}
			if (coreResult.skipped.length > 0) {
				log.blank();
				log.info("Harness files skipped (already exist):");
				for (const f of coreResult.skipped) {
					log.step(f);
				}
			}

			// Prompt to populate docs with Claude
			log.blank();
			const populateDocs = await confirm({
				message:
					"Populate documentation stubs with project-specific content using Claude?",
				default: true,
			});

			if (populateDocs) {
				const docsSpinner = createSpinner(
					"Populating documentation with project content",
				).start();
				try {
					await execa(
						"claude",
						[
							"-p",
							"Read this project's codebase and populate each documentation stub in docs/ with accurate, project-specific content. Keep the existing headings and structure but replace placeholder content with real details based on what you find in the code.",
							"--allowedTools",
							"Read,Write,Edit,Glob,Grep",
						],
						{ cwd: projectPath, timeout: 600_000 },
					);
					docsSpinner.succeed("Documentation populated with project content");
				} catch {
					docsSpinner.warn("Could not populate documentation automatically.");
					log.info("Run from the project directory:");
					log.step(
						`cd ${projectPath} && claude -p "Read this project's codebase and populate each documentation stub in docs/ with accurate, project-specific content. Keep the existing headings and structure but replace placeholder content with real details based on what you find in the code." --allowedTools Read,Write,Edit,Glob,Grep`,
					);
				}
			} else {
				log.blank();
				log.info("To populate docs later, run from the project directory:");
				log.step(
					'claude -p "Read this project\'s codebase and populate each documentation stub in docs/ with accurate, project-specific content. Keep the existing headings and structure but replace placeholder content with real details based on what you find in the code." --allowedTools Read,Write,Edit,Glob,Grep',
				);
			}

			// Install/update agent-browser skill for Claude and Codex
			const skillSpinner = createSpinner(
				"Installing agent-browser skill",
			).start();
			try {
				await execa(
					"npx",
					[
						"-y",
						"skills",
						"add",
						"vercel-labs/agent-browser",
						"--skill",
						"agent-browser",
						"--agent",
						"claude-code",
						"codex",
						"-y",
					],
					{ cwd: projectPath },
				);
				skillSpinner.succeed("agent-browser skill installed");
			} catch {
				skillSpinner.warn(
					"Could not install agent-browser skill. Install manually: npx skills add vercel-labs/agent-browser --skill agent-browser --agent claude-code codex -y",
				);
			}

			// Step 8: Commit harness files
			const commitSpinner = createSpinner("Committing harness files").start();
			await gitAdd(projectPath);
			await gitCommit("feat: add hatch agent harness", projectPath);
			commitSpinner.succeed("Committed: feat: add hatch agent harness");

			// Step 9: Push branch
			const pushSpinner = createSpinner("Pushing add-hatch branch").start();
			await gitPush(projectPath, "add-hatch", config.github?.token);
			pushSpinner.succeed("Pushed branch: add-hatch");

			// Step 10: Open PR
			const prSpinner = createSpinner("Opening pull request").start();
			const { stdout: prUrl } = await execa(
				"gh",
				[
					"pr",
					"create",
					"--title",
					"Add Hatch agent harness",
					"--body",
					"Adds the Hatch agent harness for AI-assisted development with Hatch.\n\nIncludes:\n- harness.json (risk contract)\n- AGENTS.md (agent guidelines)\n- Harness scripts (risk-tier, docs-drift, pre-pr)\n- Branch protection configuration",
					"--head",
					"add-hatch",
				],
				{ cwd: projectPath },
			);
			prSpinner.succeed(`PR opened: ${prUrl.trim()}`);

			// Apply branch protection (non-fatal)
			try {
				const { applyBranchProtection } = await import("./harden.js");
				await applyBranchProtection({
					owner: github.owner,
					repo: github.repo,
					branch: "main",
					harnessPath: projectPath,
					strict: false,
					dryRun: false,
					quiet: true,
				});
				log.step("Applied branch protection rules");
			} catch {
				log.warn(
					"Could not apply branch protection. Run 'hatch harden' manually to set up branch protection.",
				);
			}

			// Print summary
			log.blank();
			log.success("Project added successfully!");
			log.blank();
			log.info("Project details:");
			log.step(`Name:     ${projectName}`);
			log.step(`GitHub:   ${github.url}`);
			log.step(`Vercel:   ${vercel.url}`);
			log.step(`PR:       ${prUrl.trim()}`);
			log.blank();
			log.info("Next steps:");
			log.step("Review and merge the PR to onboard the harness");
			log.step(
				`Start a feature: hatch feature <feature-name> --project ${projectName}`,
			);
			log.blank();
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("User force closed")
			) {
				log.blank();
				log.info("Operation cancelled.");
				process.exit(0);
			}
			log.blank();
			log.error(
				`Failed to add project: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
