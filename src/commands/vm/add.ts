import os from "node:os";
import path from "node:path";
import { input } from "@inquirer/prompts";
import { Command } from "commander";
import { execa } from "execa";
import fs from "fs-extra";
import type { HatchConfig, ProjectRecord } from "../../types/index.js";
import { log } from "../../utils/logger.js";
import { getProject, saveProject } from "../../utils/project-store.js";
import { createSpinner } from "../../utils/spinner.js";

interface VMAddOptions {
	config?: string;
}

interface GitHubRepo {
	url: string;
	owner: { login: string };
	name: string;
}

interface SupabaseProject {
	id: string;
	name: string;
	region: string;
}

interface VercelProject {
	id: string;
	name: string;
	link?: {
		productionBranch?: string;
	};
}

export const vmAddCommand = new Command()
	.name("add")
	.description("Add an existing project to track for feature VMs")
	.argument("<project-name>", "Project name (matches repo name)")
	.option(
		"-c, --config <path>",
		"Path to hatch.json config file",
		path.join(os.homedir(), ".hatch.json"),
	)
	.action(async (projectName: string, options: VMAddOptions) => {
		try {
			log.blank();
			log.info(`Adding existing project: ${projectName}`);
			log.blank();

			// Check if project already exists
			const existing = await getProject(projectName);
			if (existing) {
				log.error(`Project "${projectName}" already exists in the store.`);
				log.info("Run 'hatch vm list --projects' to see stored projects.");
				process.exit(1);
			}

			// Load config to get org names
			const configPath =
				options.config || path.join(os.homedir(), ".hatch.json");
			let config: HatchConfig = {};
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

			// Step 2: Look up Supabase project
			const supabaseSpinner = createSpinner(
				"Looking up Supabase project",
			).start();
			let supabase: ProjectRecord["supabase"] | undefined;

			try {
				const { stdout } = await execa("supabase", [
					"projects",
					"list",
					"-o",
					"json",
				]);
				const projects = JSON.parse(stdout) as SupabaseProject[];
				const found = projects.find((p) => p.name === projectName);
				if (found) {
					supabase = {
						projectRef: found.id,
						region: found.region,
					};
					supabaseSpinner.succeed(
						`Found Supabase project: ${found.id} (${found.region})`,
					);
				} else {
					supabaseSpinner.warn("Supabase project not found by name");
				}
			} catch {
				supabaseSpinner.warn("Could not query Supabase projects");
			}

			if (!supabase) {
				const ref = await input({
					message: "Supabase project ref (or press Enter to skip):",
				});
				if (ref) {
					const region = await input({
						message: "Supabase region (e.g., us-east-1):",
						default: "us-east-1",
					});
					supabase = { projectRef: ref, region };
				}
			}

			if (!supabase) {
				log.error("Supabase project is required.");
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
							vercel = {
								projectId: idMatch[1],
								url: `https://${projectName}.vercel.app`,
							};
							vercelSpinner.succeed(`Found Vercel project: ${projectName}`);
						}
					} catch {
						// Fallback: just use the project name
						vercel = {
							projectId: projectName,
							url: `https://${projectName}.vercel.app`,
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
				supabase,
			};

			await saveProject(projectRecord);

			// Print summary
			log.blank();
			log.success("Project added successfully!");
			log.blank();
			log.info("Project details:");
			log.step(`Name:     ${projectName}`);
			log.step(`GitHub:   ${github.url}`);
			log.step(`Vercel:   ${vercel.url}`);
			log.step(`Supabase: ${supabase.projectRef} (${supabase.region})`);
			log.blank();
			log.info("Next steps:");
			log.step(
				`Start a feature: hatch vm feature <feature-name> --project ${projectName}`,
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
