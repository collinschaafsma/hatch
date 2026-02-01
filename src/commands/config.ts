import os from "node:os";
import path from "node:path";
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { Command } from "commander";
import fs from "fs-extra";
import yaml from "yaml";
import type {
	ClaudeConfig,
	ClaudeOAuthAccount,
	EnvVar,
	HatchConfig,
} from "../types/index.js";
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
 * Read GitHub token using gh CLI (handles keychain storage)
 */
async function readGitHubToken(): Promise<string | null> {
	// Check environment variable first
	if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
		return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
	}

	// Use gh auth token command which handles keychain
	const { execa } = await import("execa");
	try {
		const result = await execa("gh", ["auth", "token"]);
		const token = result.stdout.trim();
		if (token) {
			return token;
		}
	} catch {
		// gh auth token failed
	}

	// Fallback: try reading from config file (older gh versions)
	const configPath = path.join(os.homedir(), ".config", "gh", "hosts.yml");
	if (await fs.pathExists(configPath)) {
		try {
			const content = await fs.readFile(configPath, "utf-8");
			const config = yaml.parse(content);
			const githubConfig = config?.["github.com"];
			if (githubConfig?.oauth_token) {
				return githubConfig.oauth_token;
			}
		} catch {
			// Ignore parse errors
		}
	}

	return null;
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
 * Read Supabase token from CLI config or keychain
 */
async function readSupabaseToken(): Promise<string | null> {
	// Check environment variable first
	if (process.env.SUPABASE_ACCESS_TOKEN) {
		return process.env.SUPABASE_ACCESS_TOKEN;
	}

	const { execa } = await import("execa");

	// Try macOS keychain (where supabase CLI stores it)
	if (process.platform === "darwin") {
		try {
			const result = await execa("security", [
				"find-generic-password",
				"-s",
				"Supabase CLI",
				"-w",
			]);
			const keychainValue = result.stdout.trim();
			// Supabase stores it as "go-keyring-base64:<base64>" or just the token
			if (keychainValue.startsWith("go-keyring-base64:")) {
				const base64Token = keychainValue.replace("go-keyring-base64:", "");
				return Buffer.from(base64Token, "base64").toString("utf-8");
			}
			if (keychainValue) {
				return keychainValue;
			}
		} catch {
			// Not in keychain
		}
	}

	// Fallback: try reading from config file
	const configPaths = [
		path.join(os.homedir(), ".supabase", "access-token"),
		path.join(os.homedir(), ".config", "supabase", "access-token"),
	];

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

	return null;
}

/**
 * Get Vercel teams using the API
 */
async function getVercelTeams(token: string): Promise<VercelTeam[]> {
	const { execa } = await import("execa");

	try {
		// vercel teams list doesn't support --json, so we parse the text output
		// Format: "  id                            Team name"
		// Note: Vercel CLI outputs to stderr, not stdout
		const result = await execa("vercel", ["teams", "list"], {
			env: { ...process.env, VERCEL_TOKEN: token },
		});

		// Vercel CLI writes to stderr
		const output = result.stderr || result.stdout;
		const lines = output.split("\n");
		const teams: VercelTeam[] = [];

		// Find where data starts (after the header line "  id  ...  Team name")
		let dataStarted = false;

		for (const line of lines) {
			// Skip empty lines
			if (!line.trim()) {
				continue;
			}

			// Skip info lines at the start
			if (line.includes("Vercel CLI") || line.includes("Fetching")) {
				continue;
			}

			// Detect header line and mark that data follows
			if (line.trim().startsWith("id") && line.includes("Team name")) {
				dataStarted = true;
				continue;
			}

			// Only parse lines after the header
			if (!dataStarted) {
				continue;
			}

			// Parse line: "✔ team-slug                     Team Name" or "  team-slug                     Team Name"
			// The checkmark indicates currently selected team
			const cleanLine = line.replace(/^[✔\s]+/, "").trim();
			const parts = cleanLine.split(/\s{2,}/); // Split on 2+ spaces

			if (parts.length >= 2) {
				const slug = parts[0].trim();
				const name = parts[1].trim();
				if (slug && name) {
					teams.push({
						id: slug, // Vercel uses slug as the team identifier for most operations
						slug: slug,
						name: name,
					});
				}
			}
		}

		return teams;
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
 * Read git config value
 */
async function readGitConfig(key: string): Promise<string | null> {
	const { execa } = await import("execa");

	try {
		const result = await execa("git", ["config", "--global", key]);
		return result.stdout.trim() || null;
	} catch {
		return null;
	}
}

/**
 * Read Claude Code OAuth credentials from macOS Keychain and config file
 */
async function getClaudeCredentials(): Promise<ClaudeConfig | undefined> {
	// Only supported on macOS
	if (process.platform !== "darwin") {
		return undefined;
	}

	const { execa } = await import("execa");

	try {
		// Keychain stores the full JSON blob as the password
		const { stdout } = await execa("security", [
			"find-generic-password",
			"-s",
			"Claude Code-credentials",
			"-w",
		]);
		const parsed = JSON.parse(stdout.trim());
		// The keychain stores { claudeAiOauth: { accessToken, refreshToken, expiresAt, scopes, subscriptionType, rateLimitTier } }
		const oauth = parsed.claudeAiOauth;
		if (oauth?.accessToken && oauth?.refreshToken) {
			const config: ClaudeConfig = {
				accessToken: oauth.accessToken,
				refreshToken: oauth.refreshToken,
				expiresAt: oauth.expiresAt,
				scopes: oauth.scopes || [],
			};
			if (oauth.subscriptionType) {
				config.subscriptionType = oauth.subscriptionType;
			}
			if (oauth.rateLimitTier) {
				config.rateLimitTier = oauth.rateLimitTier;
			}

			// Also read oauthAccount from ~/.claude.json if it exists
			const claudeJsonPath = path.join(os.homedir(), ".claude.json");
			if (await fs.pathExists(claudeJsonPath)) {
				try {
					const claudeJson = await fs.readJson(claudeJsonPath);
					if (claudeJson.oauthAccount) {
						config.oauthAccount = {
							accountUuid: claudeJson.oauthAccount.accountUuid,
							emailAddress: claudeJson.oauthAccount.emailAddress,
							organizationUuid: claudeJson.oauthAccount.organizationUuid,
							displayName: claudeJson.oauthAccount.displayName,
							organizationName: claudeJson.oauthAccount.organizationName,
							organizationRole: claudeJson.oauthAccount.organizationRole,
						};
					}
				} catch {
					// Ignore errors reading claude.json
				}
			}

			return config;
		}
		return undefined;
	} catch {
		return undefined;
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
	.option(
		"--refresh",
		"Refresh only tokens, preserving orgs/teams/env vars from existing config",
	)
	.action(
		async (options: { output: string; global: boolean; refresh: boolean }) => {
			try {
				// Determine config path
				const configPath = options.global
					? path.join(os.homedir(), ".hatch.json")
					: path.resolve(process.cwd(), options.output);

				// Handle --refresh: just update tokens, preserve everything else
				if (options.refresh) {
					log.blank();
					log.info("Refreshing tokens in existing config...");
					log.blank();

					// Load existing config
					if (!(await fs.pathExists(configPath))) {
						log.error(`Config file not found: ${configPath}`);
						log.info(
							"Run 'hatch config --global' first to create a config file.",
						);
						process.exit(1);
					}

					const existingConfig: HatchConfig = await fs.readJson(configPath);

					// Read fresh tokens
					const githubToken = await readGitHubToken();
					const vercelToken = await readVercelToken();
					const supabaseToken = await readSupabaseToken();
					const claudeCredentials = await getClaudeCredentials();

					// Update tokens while preserving other settings
					if (githubToken) {
						existingConfig.github = {
							...existingConfig.github,
							token: githubToken,
						};
						log.success("GitHub token refreshed");
					} else {
						log.warn("Could not read GitHub token");
					}

					if (vercelToken) {
						existingConfig.vercel = {
							...existingConfig.vercel,
							token: vercelToken,
						};
						log.success("Vercel token refreshed");
					} else {
						log.warn("Could not read Vercel token");
					}

					if (supabaseToken) {
						existingConfig.supabase = {
							...existingConfig.supabase,
							token: supabaseToken,
						};
						log.success("Supabase token refreshed");
					} else {
						log.warn("Could not read Supabase token");
					}

					if (claudeCredentials) {
						existingConfig.claude = claudeCredentials;
						log.success("Claude Code credentials refreshed");
					} else {
						log.warn("Could not read Claude Code credentials");
					}

					// Write updated config
					await fs.writeJson(configPath, existingConfig, { spaces: 2 });

					log.blank();
					log.success(`Tokens refreshed in ${configPath}`);
					log.blank();
					return;
				}

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

					// Read git config for email and name
					const gitEmail = await readGitConfig("user.email");
					const gitName = await readGitConfig("user.name");

					if (gitEmail) {
						config.github.email = gitEmail;
						log.success(`Found git user.email: ${gitEmail}`);
					} else {
						log.warn(
							"Git user.email not set. Run 'git config --global user.email \"you@example.com\"'",
						);
					}

					if (gitName) {
						config.github.name = gitName;
						log.success(`Found git user.name: ${gitName}`);
					} else {
						log.warn(
							"Git user.name not set. Run 'git config --global user.name \"Your Name\"'",
						);
					}

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
						log.warn(
							"No Vercel teams found. You may need to create one first.",
						);
					}
				} else {
					log.warn(
						"Vercel token not found. Run 'vercel login' to authenticate.",
					);
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

				// Read Claude Code credentials (macOS only)
				if (process.platform === "darwin") {
					let claudeCredentials: ClaudeConfig | undefined;
					await withSpinner("Reading Claude Code credentials", async () => {
						claudeCredentials = await getClaudeCredentials();
					});

					if (claudeCredentials) {
						log.success("Found Claude Code credentials");
						config.claude = claudeCredentials;
					} else {
						log.warn(
							"Claude Code credentials not found. Run 'claude' and log in to authenticate.",
						);
					}
				}

				// Custom environment variables
				log.blank();
				log.info("Common env vars you may want to add:");
				log.step("EMAIL_FROM - Sender email address (e.g., noreply@yourdomain.com)");
				log.step("RESEND_API_KEY - Resend API key for sending emails");
				log.step("AI_GATEWAY_API_KEY - AI gateway API key for LLM requests");
				log.blank();
				const addEnvVars = await confirm({
					message: "Would you like to add custom environment variables?",
					default: false,
				});

				if (addEnvVars) {
					const envVars: EnvVar[] = [];
					let addMore = true;

					while (addMore) {
						const key = await input({
							message: "Environment variable name:",
							validate: (value) => {
								if (!value.trim()) {
									return "Variable name is required";
								}
								if (!/^[A-Z][A-Z0-9_]*$/.test(value.trim())) {
									return "Variable name must be uppercase, start with a letter, and contain only A-Z, 0-9, and underscores";
								}
								if (envVars.some((v) => v.key === value.trim())) {
									return "Variable already added";
								}
								return true;
							},
						});

						const value = await password({
							message: `Value for ${key}:`,
							mask: "*",
						});

						const environments = await checkbox({
							message: "Which environments should this variable be set in?",
							choices: [
								{
									value: "production" as const,
									name: "Production",
									checked: true,
								},
								{ value: "preview" as const, name: "Preview", checked: true },
								{
									value: "development" as const,
									name: "Development",
									checked: true,
								},
							],
						});

						if (environments.length === 0) {
							log.warn("No environments selected, skipping this variable.");
						} else {
							envVars.push({
								key: key.trim(),
								value,
								environments: environments as (
									| "production"
									| "preview"
									| "development"
								)[],
							});
							log.success(`Added ${key}`);
						}

						addMore = await confirm({
							message: "Add another environment variable?",
							default: false,
						});
					}

					if (envVars.length > 0) {
						config.envVars = envVars;
					}
				}

				// Write config file
				await fs.writeJson(configPath, config, { spaces: 2 });

				log.blank();
				log.success(`Configuration saved to ${configPath}`);
				log.blank();
				log.warn(
					"This file contains sensitive tokens - treat it like a password file.",
				);
				log.blank();

				// Show summary
				log.info("Configuration summary:");
				if (config.github?.token) {
					const githubParts = [
						config.github.org ? `org=${config.github.org}` : "personal account",
					];
					if (config.github.email)
						githubParts.push(`email=${config.github.email}`);
					if (config.github.name)
						githubParts.push(`name=${config.github.name}`);
					log.step(`GitHub: ${githubParts.join(", ")}`);
				}
				if (config.vercel?.team) {
					log.step(`Vercel: team=${config.vercel.team}`);
				}
				if (config.supabase?.org) {
					log.step(
						`Supabase: org=${config.supabase.org}, region=${config.supabase.region}`,
					);
				}
				if (config.claude?.accessToken) {
					log.step("Claude Code: credentials configured");
				}
				if (config.envVars && config.envVars.length > 0) {
					log.step(`Custom env vars: ${config.envVars.length} configured`);
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
		},
	);
