import os from "node:os";
import path from "node:path";
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { Command } from "commander";
import fs from "fs-extra";
import yaml from "yaml";
import type { EnvVar, HatchConfig } from "../types/index.js";
import {
	getProjectConfigPath,
	listProjectConfigs,
	resolveConfigPath,
} from "../utils/config-resolver.js";
import { log } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";

interface VercelTeam {
	id: string;
	slug: string;
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

/**
 * Validate tokens in config file by making API calls
 */
async function validateTokens(configPath: string): Promise<{
	github: { valid: boolean; error?: string };
	vercel: { valid: boolean; error?: string };
	convex: { valid: boolean; error?: string };
	claude: { valid: boolean; error?: string };
}> {
	const { execa } = await import("execa");
	const config: HatchConfig = await fs.readJson(configPath);

	const results = {
		github: { valid: false, error: undefined as string | undefined },
		vercel: { valid: false, error: undefined as string | undefined },
		convex: { valid: false, error: undefined as string | undefined },
		claude: { valid: false, error: undefined as string | undefined },
	};

	// Validate GitHub token
	if (config.github?.token) {
		try {
			await execa("gh", ["api", "user"], {
				env: { ...process.env, GITHUB_TOKEN: config.github.token },
			});
			results.github.valid = true;
		} catch (error) {
			results.github.error =
				error instanceof Error ? error.message : "Unknown error";
		}
	} else {
		results.github.error = "Token not configured";
	}

	// Validate Vercel token
	if (config.vercel?.token) {
		try {
			const response = await fetch("https://api.vercel.com/v2/user", {
				headers: { Authorization: `Bearer ${config.vercel.token}` },
			});
			if (response.ok) {
				results.vercel.valid = true;
			} else {
				results.vercel.error = `HTTP ${response.status}`;
			}
		} catch (error) {
			results.vercel.error =
				error instanceof Error ? error.message : "Unknown error";
		}
	} else {
		results.vercel.error = "Token not configured";
	}

	// Validate Convex access token
	if (config.convex?.accessToken) {
		try {
			const { getConvexTokenDetails } = await import("../headless/convex.js");
			await getConvexTokenDetails(config.convex.accessToken);
			results.convex.valid = true;
		} catch (error) {
			results.convex.error =
				error instanceof Error ? error.message : "Unknown error";
		}
	} else {
		results.convex.error = "Token not configured";
	}

	// Validate Anthropic API key
	if (config.anthropicApiKey) {
		// API keys don't expire — presence is sufficient
		results.claude.valid = true;
	} else {
		results.claude.error = "API key not configured";
	}

	return results;
}

// Check subcommand
const checkCommand = new Command()
	.name("check")
	.description("Validate tokens in hatch.json are still valid")
	.option("-c, --config <path>", "Path to hatch.json config file")
	.option("--project <name>", "Check a specific project's config")
	.option("--json", "Output result as JSON")
	.action(
		async (options: {
			config?: string;
			project?: string;
			json?: boolean;
		}) => {
			try {
				const configPath = await resolveConfigPath({
					configPath: options.config,
					project: options.project,
				});

				if (!(await fs.pathExists(configPath))) {
					if (options.json) {
						console.log(
							JSON.stringify({
								valid: false,
								error: `Config file not found: ${configPath}`,
							}),
						);
					} else {
						log.error(`Config file not found: ${configPath}`);
						log.info("Run 'hatch config' to create a config file.");
					}
					process.exit(1);
				}

				if (!options.json) {
					log.blank();
					log.info(`Checking tokens in ${configPath}...`);
					log.blank();
				}

				const results = await validateTokens(configPath);

				if (options.json) {
					const allValid = Object.values(results).every((r) => r.valid);
					console.log(
						JSON.stringify({
							valid: allValid,
							tokens: results,
						}),
					);
				} else {
					let allValid = true;

					if (results.github.valid) {
						log.success("GitHub: valid");
					} else {
						log.error(`GitHub: ${results.github.error}`);
						allValid = false;
					}

					if (results.vercel.valid) {
						log.success("Vercel: valid");
					} else {
						log.error(`Vercel: ${results.vercel.error}`);
						allValid = false;
					}

					if (results.convex.valid) {
						log.success("Convex: valid");
					} else {
						log.error(`Convex: ${results.convex.error}`);
						allValid = false;
					}

					if (results.claude.valid) {
						log.success("Claude Code: valid");
					} else {
						log.error(`Claude Code: ${results.claude.error}`);
						allValid = false;
					}

					log.blank();
					if (allValid) {
						log.success("All tokens are valid!");
					} else {
						log.warn("Some tokens are invalid or expired.");
						log.info("Run 'hatch config --refresh' to update tokens.");
					}
					log.blank();
				}

				const allValid = Object.values(results).every((r) => r.valid);
				process.exit(allValid ? 0 : 1);
			} catch (error) {
				if (options.json) {
					console.log(
						JSON.stringify({
							valid: false,
							error: error instanceof Error ? error.message : String(error),
						}),
					);
				} else {
					log.error(
						`Failed to check tokens: ${error instanceof Error ? error.message : error}`,
					);
				}
				process.exit(1);
			}
		},
	);

// List subcommand
const listCommand = new Command()
	.name("list")
	.description("List all project-specific configs")
	.option("--json", "Output result as JSON")
	.action(async (options: { json?: boolean }) => {
		try {
			const globalPath = path.join(os.homedir(), ".hatch.json");
			const globalExists = await fs.pathExists(globalPath);
			const projectConfigs = await listProjectConfigs();

			if (options.json) {
				const globalInfo = globalExists
					? {
							path: globalPath,
							hasGithub: false,
							hasVercel: false,
							hasConvex: false,
							hasAnthropic: false,
						}
					: null;

				if (globalExists) {
					try {
						const config = await fs.readJson(globalPath);
						if (globalInfo) {
							globalInfo.hasGithub = !!config.github?.token;
							globalInfo.hasVercel = !!config.vercel?.token;
							globalInfo.hasConvex = !!config.convex?.accessToken;
							globalInfo.hasAnthropic = !!config.anthropicApiKey;
						}
					} catch {
						// Ignore parse errors
					}
				}

				console.log(
					JSON.stringify(
						{
							global: globalInfo,
							projects: projectConfigs,
						},
						null,
						2,
					),
				);
			} else {
				log.blank();
				log.info("Hatch configurations:");
				log.blank();

				if (globalExists) {
					log.step(`Global: ${globalPath}`);
				} else {
					log.step("Global: not configured");
				}

				if (projectConfigs.length > 0) {
					log.blank();
					log.info("Per-project configs:");
					for (const config of projectConfigs) {
						const tokens = [];
						if (config.hasGithub) tokens.push("github");
						if (config.hasVercel) tokens.push("vercel");
						if (config.hasConvex) tokens.push("convex");
						if (config.hasAnthropic) tokens.push("anthropic");
						log.step(
							`${config.name}: ${tokens.length > 0 ? tokens.join(", ") : "no tokens"}`,
						);
					}
				} else {
					log.blank();
					log.info("No per-project configs found.");
					log.info("Create one with: hatch config --project <project-name>");
				}

				log.blank();
			}
		} catch (error) {
			log.error(
				`Failed to list configs: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});

export const configCommand = new Command()
	.name("config")
	.description("Generate and manage hatch.json config file")
	.option("-o, --output <path>", "Output file path (defaults to ~/.hatch.json)")
	.option(
		"--project <name>",
		"Create per-project config at ~/.hatch/configs/<name>.json",
	)
	.option(
		"--refresh",
		"Refresh only tokens, preserving orgs/teams/env vars from existing config",
	)
	.addCommand(checkCommand)
	.addCommand(listCommand)
	.action(
		async (options: {
			output?: string;
			project?: string;
			refresh: boolean;
		}) => {
			try {
				// Determine config path
				// Priority: --output > --project > global default
				let configPath: string;
				if (options.output) {
					configPath = path.resolve(process.cwd(), options.output);
				} else if (options.project) {
					configPath = await getProjectConfigPath(options.project);
				} else {
					configPath = path.join(os.homedir(), ".hatch.json");
				}

				// Handle --refresh: just update tokens, preserve everything else
				if (options.refresh) {
					log.blank();
					log.info("Refreshing tokens in existing config...");
					log.blank();

					// Load existing config
					if (!(await fs.pathExists(configPath))) {
						log.error(`Config file not found: ${configPath}`);
						log.info("Run 'hatch config' first to create a config file.");
						process.exit(1);
					}

					const existingConfig: HatchConfig = await fs.readJson(configPath);

					// Read fresh tokens
					const githubToken = await readGitHubToken();

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

					log.info("Vercel: using existing token (update via 'hatch config')");
					log.info("Convex: using existing token (update via 'hatch config')");
					log.info(
						"Anthropic: API keys don't expire (update via 'hatch config')",
					);

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

				const config: HatchConfig = { convex: {} };

				// Set project name if creating per-project config
				if (options.project) {
					config.project = options.project;
				}

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

				// Vercel token (manual entry from dashboard)
				log.info(
					"Create a Vercel token at: https://vercel.com/account/settings/tokens",
				);
				const vercelToken = await password({
					message: "Vercel token:",
					mask: "*",
				});

				if (vercelToken) {
					// Validate by fetching teams
					const teams = await getVercelTeams(vercelToken);

					if (teams.length > 0) {
						log.success("Vercel token validated");
						config.vercel = { token: vercelToken };

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
							"Could not fetch Vercel teams. Token may be invalid or you may need to create a team first.",
						);
						const useAnyway = await confirm({
							message: "Save this token anyway?",
							default: false,
						});
						if (useAnyway) {
							config.vercel = { token: vercelToken };
						}
					}
				} else {
					log.warn(
						"No Vercel token provided. You can add one later with 'hatch config'.",
					);
				}

				// Convex access token (required)
				log.info(
					"Generate an access token at: https://dashboard.convex.dev/settings",
				);
				const convexAccessToken = await password({
					message: "Convex access token:",
					mask: "*",
				});

				if (convexAccessToken) {
					// Validate token via API
					try {
						const { getConvexTokenDetails } = await import(
							"../headless/convex.js"
						);
						await withSpinner("Validating Convex access token", async () => {
							await getConvexTokenDetails(convexAccessToken);
						});
						config.convex = { accessToken: convexAccessToken };
						log.success("Convex access token configured and validated");
					} catch (error) {
						log.warn(
							`Convex token validation failed: ${error instanceof Error ? error.message : error}`,
						);
						const useAnyway = await confirm({
							message: "Save this token anyway?",
							default: false,
						});
						if (useAnyway) {
							config.convex = { accessToken: convexAccessToken };
						}
					}
				} else {
					log.warn(
						"No Convex token provided. You will need one to create projects.",
					);
				}

				// Anthropic API key
				log.info(
					"Create an API key at: https://console.anthropic.com/settings/keys",
				);
				const anthropicApiKey = await password({
					message: "Anthropic API key:",
					mask: "*",
				});

				if (anthropicApiKey) {
					config.anthropicApiKey = anthropicApiKey;
					log.success("Anthropic API key configured");
				} else {
					log.warn(
						"No Anthropic API key provided. Spikes will not be able to run.",
					);
				}

				// Custom environment variables
				log.blank();
				log.info("Common env vars you may want to add:");
				log.step(
					"EMAIL_FROM - Sender email address (e.g., noreply@yourdomain.com)",
				);
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
				if (config.convex?.accessToken) {
					log.step("Convex: access token configured");
				}
				if (config.anthropicApiKey) {
					log.step("Anthropic: API key configured");
				}
				if (config.envVars && config.envVars.length > 0) {
					log.step(`Custom env vars: ${config.envVars.length} configured`);
				}
				log.blank();

				// Check for missing tokens
				const missingTokens: string[] = [];
				if (!config.github?.token) missingTokens.push("GitHub");
				if (!config.vercel?.token) missingTokens.push("Vercel");
				if (!config.convex?.accessToken) missingTokens.push("Convex");

				if (missingTokens.length > 0) {
					log.warn(`Missing tokens for: ${missingTokens.join(", ")}`);
					log.info("To add missing tokens, run this command again:");
					if (!config.github?.token) log.step("GitHub: run 'gh auth login'");
					if (!config.vercel?.token)
						log.step(
							"Vercel: create token at https://vercel.com/account/settings/tokens",
						);
					if (!config.convex?.accessToken)
						log.step(
							"Convex: create token at https://dashboard.convex.dev/settings",
						);
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
