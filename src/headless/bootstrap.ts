import { execa } from "execa";
import type { ResolvedHeadlessConfig } from "../types/index.js";
import { log } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import {
	checkRequiredClis,
	ghAuthStatus,
	isCliInstalled,
	supabaseAuthStatus,
	vercelAuthStatus,
} from "./cli-wrappers.js";

/**
 * Check Node.js version meets requirements (18+)
 */
export async function checkNodeVersion(): Promise<void> {
	const version = process.version;
	const major = Number.parseInt(version.slice(1).split(".")[0], 10);

	if (major < 18) {
		throw new Error(`Node.js 18+ is required. Current version: ${version}`);
	}
}

/**
 * Install a CLI tool via npm globally
 */
async function installCliViaNpm(
	cli: string,
	packageName?: string,
): Promise<void> {
	const pkg = packageName || cli;
	await execa("npm", ["install", "-g", pkg], { stdio: "pipe" });
}

/**
 * Install missing CLI tools
 */
export async function installMissingClis(quiet: boolean): Promise<void> {
	const { missing } = await checkRequiredClis();

	if (missing.length === 0) {
		if (!quiet) {
			log.success("All required CLIs are installed");
		}
		return;
	}

	// Map CLI names to npm packages
	const cliPackages: Record<string, string> = {
		gh: "gh",
		vercel: "vercel",
		supabase: "supabase",
	};

	for (const cli of missing) {
		// Skip git and pnpm - these must be pre-installed
		if (cli === "git" || cli === "pnpm") {
			throw new Error(
				`${cli} must be installed manually before running in bootstrap mode.`,
			);
		}

		const packageName = cliPackages[cli];
		if (!packageName) {
			throw new Error(`Unknown CLI: ${cli}`);
		}

		if (!quiet) {
			await withSpinner(`Installing ${cli}`, async () => {
				await installCliViaNpm(cli, packageName);
			});
		} else {
			await installCliViaNpm(cli, packageName);
		}
	}
}

/**
 * Authenticate CLIs using provided tokens
 */
export async function authenticateClis(
	config: ResolvedHeadlessConfig,
	quiet: boolean,
): Promise<void> {
	// GitHub - authenticate using gh auth login with token
	const ghStatus = await ghAuthStatus(config.github.token);
	if (!ghStatus.isAuthenticated) {
		if (!quiet) {
			await withSpinner("Authenticating GitHub CLI", async () => {
				await authenticateGitHub(config.github.token);
			});
		} else {
			await authenticateGitHub(config.github.token);
		}
	} else if (!quiet) {
		log.success(`GitHub CLI authenticated as ${ghStatus.username}`);
	}

	// Vercel - uses VERCEL_TOKEN env var automatically, just verify
	const vercelStatus = await vercelAuthStatus(config.vercel.token);
	if (!vercelStatus.isAuthenticated) {
		throw new Error("Vercel authentication failed. Check your VERCEL_TOKEN.");
	}
	if (!quiet) {
		log.success(`Vercel CLI authenticated as ${vercelStatus.username}`);
	}

	// Supabase - uses SUPABASE_ACCESS_TOKEN env var automatically, just verify
	const supabaseStatus = await supabaseAuthStatus(config.supabase.token);
	if (!supabaseStatus.isAuthenticated) {
		throw new Error(
			"Supabase authentication failed. Check your SUPABASE_ACCESS_TOKEN.",
		);
	}
	if (!quiet) {
		log.success("Supabase CLI authenticated");
	}
}

/**
 * Authenticate GitHub CLI using a token
 */
async function authenticateGitHub(token: string): Promise<void> {
	// gh auth login --with-token reads from stdin
	await execa("gh", ["auth", "login", "--with-token"], {
		input: token,
		stdio: ["pipe", "pipe", "pipe"],
	});
}

/**
 * Run full bootstrap process
 */
export async function runBootstrap(
	config: ResolvedHeadlessConfig,
	quiet: boolean,
): Promise<void> {
	// Check Node.js version
	await checkNodeVersion();

	// Check pnpm is installed
	if (!(await isCliInstalled("pnpm"))) {
		throw new Error(
			"pnpm is required but not installed. Install it with: npm install -g pnpm",
		);
	}

	// Check git is installed
	if (!(await isCliInstalled("git"))) {
		throw new Error("git is required but not installed.");
	}

	// Install missing CLIs
	await installMissingClis(quiet);

	// Authenticate CLIs
	await authenticateClis(config, quiet);
}
