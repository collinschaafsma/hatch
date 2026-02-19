import os from "node:os";
import path from "node:path";
import { confirm, input } from "@inquirer/prompts";
import { Command } from "commander";
import { execa } from "execa";
import fs from "fs-extra";
import { vercelGetProjectUrl } from "../headless/cli-wrappers.js";
import type { HatchConfig, ProjectRecord } from "../types/index.js";
import {
	mergeHarnessPackageJsonScripts,
	scaffoldHarness,
} from "../utils/harness-scaffold.js";
import { log } from "../utils/logger.js";
import { getProject, saveProject } from "../utils/project-store.js";
import { createSpinner } from "../utils/spinner.js";

interface AddOptions {
	config?: string;
	cwd?: string;
	skipHarness?: boolean;
}

interface GitHubRepo {
	url: string;
	owner: { login: string };
	name: string;
}

interface VercelProject {
	id: string;
	name: string;
	link?: {
		productionBranch?: string;
	};
}

export const addCommand = new Command()
	.name("add")
	.description("Add an existing project to track for feature VMs")
	.argument("<project-name>", "Project name (matches repo name)")
	.option(
		"-c, --config <path>",
		"Path to hatch.json config file",
		path.join(os.homedir(), ".hatch.json"),
	)
	.option("--cwd <path>", "Local project directory", process.cwd())
	.option("--skip-harness", "Skip harness scaffolding, only save ProjectRecord")
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

			// Load config to get org names
			const configPath =
				options.config || path.join(os.homedir(), ".hatch.json");
			let config: HatchConfig = { convex: {} };
			if (await fs.pathExists(configPath)) {
				config = await fs.readJson(configPath);
			}

			const githubOrg = config.github?.org;
			const vercelTeam = config.vercel?.team;

			// Step 1: Look up GitHub repo
			const githubSpinner = createSpinner("Looking up GitHub repo").start();
			let github: ProjectRecord["github"] | undefined;

			try {
				const repoPath = githubOrg
					? `${githubOrg}/${projectName}`
					: projectName;
				const { stdout } = await execa("gh", [
					"repo",
					"view",
					repoPath,
					"--json",
					"url,owner,name",
				]);
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
					// Parse URL like https://github.com/owner/repo
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

			// Step 2: Look up Convex project
			const convexSpinner = createSpinner("Looking up Convex project").start();
			let convex: ProjectRecord["convex"] | undefined;

			try {
				const convexAccessToken = config.convex?.accessToken;
				if (convexAccessToken) {
					const { getConvexTokenDetails } = await import(
						"../headless/convex.js"
					);
					const tokenDetails = await getConvexTokenDetails(convexAccessToken);
					// Look for a project matching the name
					// For now, ask the user for the project slug
					convexSpinner.warn("Convex project auto-detection not yet supported");
				} else {
					convexSpinner.warn("Convex access token not configured");
				}
			} catch {
				convexSpinner.warn("Could not query Convex projects");
			}

			if (!convex) {
				const slug = await input({
					message: "Convex project slug (or press Enter to skip):",
				});
				if (slug) {
					const deploymentUrl = await input({
						message: "Convex deployment URL:",
						default: `https://${slug}.convex.cloud`,
					});
					const deployKey = await input({
						message: "Convex deploy key (or press Enter to skip):",
					});
					const deploymentName = await input({
						message: "Convex deployment name (or press Enter to skip):",
					});
					convex = {
						projectSlug: slug,
						deploymentUrl,
						deploymentName: deploymentName || slug,
						deployKey: deployKey || "",
					};
				}
			}

			if (!convex) {
				log.error("Convex project is required.");
				process.exit(1);
			}

			// Step 3: Look up Vercel project
			const vercelSpinner = createSpinner("Looking up Vercel project").start();
			let vercel: ProjectRecord["vercel"] | undefined;

			try {
				// vercel project ls outputs JSON with --json flag (if available)
				// Fall back to vercel projects command
				const args = ["project", "ls"];
				if (vercelTeam) {
					args.push("--scope", vercelTeam);
				}

				const { stdout } = await execa("vercel", args, {
					env: { ...process.env, VERCEL_TOKEN: config.vercel?.token },
				});

				// Parse the output - vercel project ls outputs a table, not JSON
				// Look for project name in the output
				if (stdout.includes(projectName)) {
					// Try to get project details
					try {
						const detailArgs = ["project", "inspect", projectName];
						if (vercelTeam) {
							detailArgs.push("--scope", vercelTeam);
						}
						const { stdout: detail } = await execa("vercel", detailArgs, {
							env: { ...process.env, VERCEL_TOKEN: config.vercel?.token },
						});
						// Parse project ID from output
						const idMatch = detail.match(/ID:\s*(\S+)/);
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
						}
					} catch {
						// Fallback: just use the project name
						const result = await vercelGetProjectUrl({
							projectId: projectName,
							projectName,
							token: config.vercel?.token,
						});
						vercel = {
							projectId: projectName,
							url: result.url,
						};
						vercelSpinner.succeed(`Found Vercel project: ${projectName}`);
					}
				} else {
					vercelSpinner.warn("Vercel project not found by name");
				}
			} catch {
				vercelSpinner.warn("Could not query Vercel projects");
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

			// Step 4: Save project
			const projectRecord: ProjectRecord = {
				name: projectName,
				createdAt: new Date().toISOString(),
				github,
				vercel,
				convex,
			};

			await saveProject(projectRecord);

			// Auto-clone repo locally for agent context
			try {
				const { cloneProject } = await import("./clone.js");
				const cloneResult = await cloneProject(projectName);
				log.step(`Cloned to ${cloneResult.path}`);
			} catch {
				log.warn(
					"Could not auto-clone repo locally. Run 'hatch clone' manually.",
				);
			}

			// Step 5: Scaffold harness files
			if (!options.skipHarness) {
				const projectPath = path.resolve(options.cwd || process.cwd());

				if (!(await fs.pathExists(projectPath))) {
					log.warn(
						`Directory ${projectPath} does not exist, skipping harness scaffolding.`,
					);
					log.info(
						"Run 'hatch harden' in your project directory to set up the harness later.",
					);
				} else {
					// Write core harness files (skip existing)
					const harnessSpinner = createSpinner(
						"Scaffolding agent harness",
					).start();
					const coreResult = await scaffoldHarness({
						projectPath,
						projectName,
						skipExisting: true,
						includeDocs: false,
					});
					harnessSpinner.succeed("Agent harness scaffolded");

					// Merge harness scripts into package.json
					const pkgPath = path.join(projectPath, "package.json");
					const scriptsAdded = await mergeHarnessPackageJsonScripts(pkgPath);
					if (scriptsAdded) {
						log.step("Added harness scripts to package.json");
					}

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

					// Prompt for docs stubs
					log.blank();
					const wantDocs = await confirm({
						message: "Generate documentation stubs?",
						default: true,
					});

					if (wantDocs) {
						const docsResult = await scaffoldHarness({
							projectPath,
							projectName,
							skipExisting: true,
							includeDocs: true,
						});

						if (docsResult.written.length > 0) {
							log.info("Documentation stubs written:");
							for (const f of docsResult.written) {
								log.step(f);
							}
							log.blank();
							log.info(
								"Run Claude in your project to fill in docs with project-specific content.",
							);
						}
					}
				}
			}

			// Print summary
			log.blank();
			log.success("Project added successfully!");
			log.blank();
			log.info("Project details:");
			log.step(`Name:     ${projectName}`);
			log.step(`GitHub:   ${github.url}`);
			log.step(`Vercel:   ${vercel.url}`);
			log.step(`Convex:   ${convex.projectSlug}`);
			log.blank();
			log.info("Next steps:");
			if (!options.skipHarness) {
				log.step("Commit the new harness files to your repository");
			}
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
