import os from "node:os";
import path from "node:path";
import { select } from "@inquirer/prompts";
import { Command } from "commander";
import fs from "fs-extra";
import yaml from "yaml";
import type { HatchConfig } from "../types/index.js";
import { log } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";

interface VercelTeam {
	id: string;
	slug: string;
	name: string;
}

interface SupabaseOrg {
	id: string;
	name: string;
}

/**
 * Read GitHub token from gh CLI config
 */
async function readGitHubToken(): Promise<string | null> {
	const configPaths = [path.join(os.homedir(), ".config", "gh", "hosts.yml")];

	for (const configPath of configPaths) {
		if (await fs.pathExists(configPath)) {
			try {
				const content = await fs.readFile(configPath, "utf-8");
				const config = yaml.parse(content);
				// GitHub config structure: { "github.com": { oauth_token: "..." } }
				const githubConfig = config?.["github.com"];
				if (githubConfig?.oauth_token) {
					return githubConfig.oauth_token;
				}
			} catch {
				// Continue to next path
			}
		}
	}

	// Also check environment variable
	return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
}

/**
 * Read Vercel token from vercel CLI config
 */
async function readVercelToken(): Promise<string | null> {
	const configPaths = [
		// macOS
		path.join(
			os.homedir(),
			"Library",
			"Application Support",
			"com.vercel.cli",
			"auth.json",
		),
		// Linux
		path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
		// Alternative location
		path.join(os.homedir(), ".vercel", "auth.json"),
	];

	for (const configPath of configPaths) {
		if (await fs.pathExists(configPath)) {
			try {
				const config = await fs.readJson(configPath);
				if (config?.token) {
					return config.token;
				}
			} catch {
				// Continue to next path
			}
		}
	}

	// Also check environment variable
	return process.env.VERCEL_TOKEN || null;
}

/**
 * Read Supabase token from supabase CLI config
 */
async function readSupabaseToken(): Promise<string | null> {
	const configPaths = [path.join(os.homedir(), ".supabase", "access-token")];

	for (const configPath of configPaths) {
		if (await fs.pathExists(configPath)) {
			try {
				const token = await fs.readFile(configPath, "utf-8");
				return token.trim();
			} catch {
				// Continue to next path
			}
		}
	}

	// Also check environment variable
	return process.env.SUPABASE_ACCESS_TOKEN || null;
}

/**
 * Get Vercel teams using the API
 */
async function getVercelTeams(token: string): Promise<VercelTeam[]> {
	const { execa } = await import("execa");

	try {
		const result = await execa("vercel", ["teams", "list", "--json"], {
			env: { ...process.env, VERCEL_TOKEN: token },
		});

		// Parse the JSON output - it's an object with teams array
		const data = JSON.parse(result.stdout);
		return data.teams || [];
	} catch {
		return [];
	}
}

/**
 * Get Supabase organizations using the CLI
 */
async function getSupabaseOrgs(token: string): Promise<SupabaseOrg[]> {
	const { execa } = await import("execa");

	try {
		const result = await execa(
			"supabase",
			["orgs", "list", "--output", "json"],
			{
				env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
			},
		);

		return JSON.parse(result.stdout) || [];
	} catch {
		return [];
	}
}

/**
 * Get GitHub username using the CLI
 */
async function getGitHubUsername(token: string): Promise<string | null> {
	const { execa } = await import("execa");

	try {
		const result = await execa("gh", ["api", "user", "--jq", ".login"], {
			env: { ...process.env, GITHUB_TOKEN: token },
		});
		return result.stdout.trim();
	} catch {
		return null;
	}
}

/**
 * Get GitHub organizations using the CLI
 */
async function getGitHubOrgs(
	token: string,
): Promise<Array<{ login: string; name: string }>> {
	const { execa } = await import("execa");

	try {
		const result = await execa(
			"gh",
			[
				"api",
				"user/orgs",
				"--jq",
				"[.[] | {login: .login, name: (.name // .login)}]",
			],
			{
				env: { ...process.env, GITHUB_TOKEN: token },
			},
		);
		return JSON.parse(result.stdout) || [];
	} catch {
		return [];
	}
}

const SUPABASE_REGIONS = [
	{ value: "us-east-1", label: "US East (N. Virginia)" },
	{ value: "us-west-1", label: "US West (N. California)" },
	{ value: "us-west-2", label: "US West (Oregon)" },
	{ value: "ca-central-1", label: "Canada (Central)" },
	{ value: "eu-west-1", label: "Europe (Ireland)" },
	{ value: "eu-west-2", label: "Europe (London)" },
	{ value: "eu-west-3", label: "Europe (Paris)" },
	{ value: "eu-central-1", label: "Europe (Frankfurt)" },
	{ value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
	{ value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
	{ value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
	{ value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
	{ value: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
	{ value: "sa-east-1", label: "South America (São Paulo)" },
];

export const configCommand = new Command()
	.name("config")
	.description("Generate a hatch.json config file from local CLI configs")
	.option("-o, --output <path>", "Output file path", "hatch.json")
	.option("--global", "Write to ~/.hatch.json instead of current directory")
	.action(async (options: { output: string; global: boolean }) => {
		try {
			log.blank();
			log.info("Generating hatch.json configuration...");
			log.blank();

			const config: HatchConfig = {};

			// Read GitHub token
			let githubToken: string | null = null;
			await withSpinner("Reading GitHub CLI config", async () => {
				githubToken = await readGitHubToken();
			});

			if (githubToken) {
				log.success("Found GitHub token");
				config.github = { token: githubToken };

				// Get username and orgs
				const username = await getGitHubUsername(githubToken);
				const orgs = await getGitHubOrgs(githubToken);

				if (orgs.length > 0 || username) {
					const choices = [];

					if (username) {
						choices.push({
							value: "",
							name: `${username} (personal account)`,
						});
					}

					for (const org of orgs) {
						choices.push({
							value: org.login,
							name: `${org.login} (organization)`,
						});
					}

					const selectedOrg = await select({
						message: "Select GitHub account/organization:",
						choices,
					});

					if (selectedOrg) {
						config.github.org = selectedOrg;
					}
				}
			} else {
				log.warn(
					"GitHub token not found. Run 'gh auth login' to authenticate.",
				);
			}

			// Read Vercel token
			let vercelToken: string | null = null;
			await withSpinner("Reading Vercel CLI config", async () => {
				vercelToken = await readVercelToken();
			});

			if (vercelToken) {
				log.success("Found Vercel token");
				config.vercel = { token: vercelToken };

				// Get teams
				const teams = await getVercelTeams(vercelToken);

				if (teams.length > 0) {
					const teamChoices = teams.map((team) => ({
						value: team.id,
						name: `${team.name} (${team.slug})`,
					}));

					const selectedTeam = await select({
						message: "Select Vercel team:",
						choices: teamChoices,
					});

					config.vercel.team = selectedTeam;
				} else {
					log.warn("No Vercel teams found. You may need to create one first.");
				}
			} else {
				log.warn("Vercel token not found. Run 'vercel login' to authenticate.");
			}

			// Read Supabase token
			let supabaseToken: string | null = null;
			await withSpinner("Reading Supabase CLI config", async () => {
				supabaseToken = await readSupabaseToken();
			});

			if (supabaseToken) {
				log.success("Found Supabase token");
				config.supabase = { token: supabaseToken };

				// Get organizations
				const orgs = await getSupabaseOrgs(supabaseToken);

				if (orgs.length > 0) {
					const orgChoices = orgs.map((org) => ({
						value: org.id,
						name: org.name,
					}));

					const selectedOrg = await select({
						message: "Select Supabase organization:",
						choices: orgChoices,
					});

					config.supabase.org = selectedOrg;
				} else {
					log.warn(
						"No Supabase organizations found. You may need to create one first.",
					);
				}

				// Select region
				const selectedRegion = await select({
					message: "Select default Supabase region:",
					choices: SUPABASE_REGIONS.map((r) => ({
						value: r.value,
						name: `${r.label} (${r.value})`,
					})),
					default: "us-east-1",
				});

				config.supabase.region = selectedRegion;
			} else {
				log.warn(
					"Supabase token not found. Run 'supabase login' to authenticate.",
				);
			}

			// Determine output path
			const outputPath = options.global
				? path.join(os.homedir(), ".hatch.json")
				: path.resolve(process.cwd(), options.output);

			// Write config file
			await fs.writeJson(outputPath, config, { spaces: 2 });

			log.blank();
			log.success(`Configuration saved to ${outputPath}`);
			log.blank();

			// Show summary
			log.info("Configuration summary:");
			if (config.github?.token) {
				log.step(
					`GitHub: ${config.github.org ? `org=${config.github.org}` : "personal account"}`,
				);
			}
			if (config.vercel?.team) {
				log.step(`Vercel: team=${config.vercel.team}`);
			}
			if (config.supabase?.org) {
				log.step(
					`Supabase: org=${config.supabase.org}, region=${config.supabase.region}`,
				);
			}
			log.blank();

			// Check for missing tokens
			const missingTokens: string[] = [];
			if (!config.github?.token) missingTokens.push("GitHub");
			if (!config.vercel?.token) missingTokens.push("Vercel");
			if (!config.supabase?.token) missingTokens.push("Supabase");

			if (missingTokens.length > 0) {
				log.warn(`Missing tokens for: ${missingTokens.join(", ")}`);
				log.info(
					"Authenticate with these CLIs first, then run this command again:",
				);
				if (!config.github?.token) log.step("gh auth login");
				if (!config.vercel?.token) log.step("vercel login");
				if (!config.supabase?.token) log.step("supabase login");
				log.blank();
			}
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("User force closed")
			) {
				log.blank();
				log.info("Configuration cancelled.");
				process.exit(0);
			}
			log.error(
				`Failed to generate config: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
