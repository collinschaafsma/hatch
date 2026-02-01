import { type Options, execa } from "execa";

export interface ExecResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

/**
 * Execute a command and return structured result
 */
async function exec(
	command: string,
	args: string[],
	options?: Options,
): Promise<ExecResult> {
	try {
		const result = await execa(command, args, {
			stdio: "pipe",
			...options,
		});
		return {
			stdout: typeof result.stdout === "string" ? result.stdout : "",
			stderr: typeof result.stderr === "string" ? result.stderr : "",
			exitCode: result.exitCode ?? 0,
		};
	} catch (error) {
		if (error && typeof error === "object" && "exitCode" in error) {
			const execaError = error as {
				exitCode: number;
				stdout?: string;
				stderr?: string;
			};
			return {
				stdout: execaError.stdout ?? "",
				stderr: execaError.stderr ?? "",
				exitCode: execaError.exitCode,
			};
		}
		throw error;
	}
}

// ============================================================================
// GitHub CLI (gh)
// ============================================================================

export interface GhAuthStatus {
	isAuthenticated: boolean;
	username?: string;
	error?: string;
}

export async function ghAuthStatus(token?: string): Promise<GhAuthStatus> {
	const env = token ? { ...process.env, GITHUB_TOKEN: token } : process.env;

	const result = await exec("gh", ["auth", "status"], { env });

	if (result.exitCode === 0) {
		// Parse username from output like "Logged in to github.com account username"
		const match = result.stdout.match(/account\s+(\S+)/);
		return {
			isAuthenticated: true,
			username: match?.[1],
		};
	}

	return {
		isAuthenticated: false,
		error: result.stderr || "Not authenticated",
	};
}

export async function ghRepoExists(
	owner: string,
	repo: string,
	token?: string,
): Promise<boolean> {
	const env = token ? { ...process.env, GITHUB_TOKEN: token } : process.env;

	const result = await exec("gh", ["repo", "view", `${owner}/${repo}`], {
		env,
	});
	return result.exitCode === 0;
}

export async function ghRepoCreate(
	name: string,
	options: {
		org?: string;
		private?: boolean;
		description?: string;
		cwd: string;
		token?: string;
	},
): Promise<{ url: string; owner: string; repo: string }> {
	const args = ["repo", "create"];

	if (options.org) {
		args.push(`${options.org}/${name}`);
	} else {
		args.push(name);
	}

	args.push("--private");
	args.push("--source=.");
	args.push("--push");

	if (options.description) {
		args.push(`--description=${options.description}`);
	}

	const env = options.token
		? { ...process.env, GITHUB_TOKEN: options.token }
		: process.env;

	const result = await exec("gh", args, { cwd: options.cwd, env });

	if (result.exitCode !== 0) {
		throw new Error(`Failed to create GitHub repo: ${result.stderr}`);
	}

	// Parse the repo URL from output
	const urlMatch = result.stdout.match(
		/https:\/\/github\.com\/([^/]+)\/([^\s]+)/,
	);
	if (!urlMatch) {
		// Try to construct URL from args
		const owner = options.org || (await getGhUsername(options.token));
		return {
			url: `https://github.com/${owner}/${name}`,
			owner,
			repo: name,
		};
	}

	return {
		url: urlMatch[0],
		owner: urlMatch[1],
		repo: urlMatch[2],
	};
}

export async function getGhUsername(token?: string): Promise<string> {
	const env = token ? { ...process.env, GITHUB_TOKEN: token } : process.env;

	const result = await exec("gh", ["api", "user", "--jq", ".login"], { env });

	if (result.exitCode !== 0) {
		throw new Error("Failed to get GitHub username");
	}

	return result.stdout.trim();
}

// ============================================================================
// Vercel CLI
// ============================================================================

/**
 * Get the actual production URL for a Vercel project from the API
 * Falls back to constructed URL if API call fails or no token provided
 */
export async function vercelGetProjectUrl(options: {
	projectId: string;
	projectName: string;
	token?: string;
}): Promise<string> {
	if (!options.token) {
		return `https://${options.projectName}.vercel.app`;
	}

	try {
		const response = await fetch(
			`https://api.vercel.com/v9/projects/${options.projectId}`,
			{
				headers: {
					Authorization: `Bearer ${options.token}`,
				},
			},
		);

		if (!response.ok) {
			return `https://${options.projectName}.vercel.app`;
		}

		const project = (await response.json()) as { alias?: string[] };

		// Check aliases array - Vercel puts the production domain here
		if (project.alias?.length) {
			return `https://${project.alias[0]}`;
		}

		// Fallback to project name
		return `https://${options.projectName}.vercel.app`;
	} catch {
		return `https://${options.projectName}.vercel.app`;
	}
}

export interface VercelAuthStatus {
	isAuthenticated: boolean;
	username?: string;
	email?: string;
	error?: string;
}

export async function vercelAuthStatus(
	token?: string,
): Promise<VercelAuthStatus> {
	// Use both env var AND --token flag for maximum compatibility
	const env = token ? { ...process.env, VERCEL_TOKEN: token } : process.env;
	const args = token ? ["whoami", "--token", token] : ["whoami"];

	const result = await exec("vercel", args, { env });

	if (result.exitCode === 0) {
		return {
			isAuthenticated: true,
			username: result.stdout.trim(),
		};
	}

	return {
		isAuthenticated: false,
		error: result.stderr || "Not authenticated",
	};
}

export async function vercelLink(options: {
	projectName: string;
	team?: string;
	cwd: string;
	token?: string;
}): Promise<{ projectId: string }> {
	// Use both env var and --token flag for maximum compatibility
	const env = options.token
		? { ...process.env, VERCEL_TOKEN: options.token }
		: process.env;
	const args = ["link", "--yes", `--project=${options.projectName}`];
	if (options.token) {
		args.push("--token", options.token);
	}

	const result = await exec("vercel", args, { cwd: options.cwd, env });

	if (result.exitCode !== 0) {
		throw new Error(`Failed to link Vercel project: ${result.stderr}`);
	}

	// Read .vercel/project.json to get project ID
	const projectJsonPath = `${options.cwd}/.vercel/project.json`;
	try {
		const { default: fs } = await import("fs-extra");
		const projectJson = await fs.readJson(projectJsonPath);
		return { projectId: projectJson.projectId };
	} catch {
		return { projectId: "unknown" };
	}
}

export async function vercelGitConnect(options: {
	cwd: string;
	token?: string;
	gitUrl?: string;
}): Promise<void> {
	const env = options.token
		? { ...process.env, VERCEL_TOKEN: options.token }
		: process.env;
	const args = ["git", "connect"];

	// Pass the git URL explicitly if provided (required for monorepos)
	if (options.gitUrl) {
		args.push(options.gitUrl);
	}

	args.push("--yes");

	if (options.token) {
		args.push("--token", options.token);
	}

	const result = await exec("vercel", args, { cwd: options.cwd, env });

	// "already connected" is a success case, not an error
	const output = result.stdout + result.stderr;
	if (result.exitCode !== 0 && !output.includes("already connected")) {
		throw new Error(`Failed to connect Git to Vercel: ${result.stderr}`);
	}
}

export async function vercelEnvAdd(options: {
	key: string;
	value: string;
	environments: ("production" | "preview" | "development")[];
	cwd: string;
	token?: string;
}): Promise<void> {
	const env = options.token
		? { ...process.env, VERCEL_TOKEN: options.token }
		: process.env;

	for (const environment of options.environments) {
		const args = ["env", "add", options.key, environment, "--yes"];
		if (options.token) {
			args.push("--token", options.token);
		}

		// Use echo to pipe the value to vercel env add
		const result = await execa("vercel", args, {
			cwd: options.cwd,
			input: options.value,
			env,
		});

		if (result.exitCode !== 0) {
			throw new Error(
				`Failed to add env var ${options.key} for ${environment}: ${result.stderr}`,
			);
		}
	}
}

export async function vercelEnvPull(options: {
	cwd: string;
	token?: string;
	environment?: "production" | "preview" | "development";
}): Promise<void> {
	const env = options.token
		? { ...process.env, VERCEL_TOKEN: options.token }
		: process.env;
	const args = ["env", "pull", ".env.local", "--yes"];
	if (options.environment) {
		args.push(`--environment=${options.environment}`);
	}
	if (options.token) {
		args.push("--token", options.token);
	}

	const result = await exec("vercel", args, { cwd: options.cwd, env });

	if (result.exitCode !== 0) {
		throw new Error(`Failed to pull Vercel env vars: ${result.stderr}`);
	}
}

export async function vercelDeploy(options: {
	cwd: string;
	token?: string;
	prod?: boolean;
}): Promise<{ url: string }> {
	const env = options.token
		? { ...process.env, VERCEL_TOKEN: options.token }
		: process.env;
	const args = ["deploy", "--yes"];
	if (options.prod) {
		args.push("--prod");
	}
	if (options.token) {
		args.push("--token", options.token);
	}

	const result = await exec("vercel", args, { cwd: options.cwd, env });

	if (result.exitCode !== 0) {
		throw new Error(`Failed to deploy to Vercel: ${result.stderr}`);
	}

	// The deployment URL is typically the last line of output
	const url = result.stdout.trim().split("\n").pop() || "";
	return { url };
}

// ============================================================================
// Supabase CLI
// ============================================================================

export interface SupabaseAuthStatus {
	isAuthenticated: boolean;
	error?: string;
}

export async function supabaseAuthStatus(
	token?: string,
): Promise<SupabaseAuthStatus> {
	const env = token
		? { ...process.env, SUPABASE_ACCESS_TOKEN: token }
		: process.env;

	// Try to list projects - if it works, we're authenticated
	const result = await exec("supabase", ["projects", "list"], { env });

	if (result.exitCode === 0) {
		return { isAuthenticated: true };
	}

	return {
		isAuthenticated: false,
		error: result.stderr || "Not authenticated",
	};
}

export interface SupabaseProject {
	id: string;
	name: string;
	region: string;
	organizationId: string;
	status: string;
}

export async function supabaseProjectsList(
	token?: string,
): Promise<SupabaseProject[]> {
	const env = token
		? { ...process.env, SUPABASE_ACCESS_TOKEN: token }
		: process.env;

	const result = await exec(
		"supabase",
		["projects", "list", "--output", "json"],
		{
			env,
		},
	);

	if (result.exitCode !== 0) {
		throw new Error(`Failed to list Supabase projects: ${result.stderr}`);
	}

	try {
		return JSON.parse(result.stdout) as SupabaseProject[];
	} catch {
		return [];
	}
}

export async function supabaseProjectExists(
	name: string,
	orgId: string,
	token?: string,
): Promise<boolean> {
	const projects = await supabaseProjectsList(token);
	return projects.some((p) => p.name === name && p.organizationId === orgId);
}

export async function supabaseProjectCreate(options: {
	name: string;
	orgId: string;
	region: string;
	dbPassword: string;
	token?: string;
}): Promise<{ projectRef: string }> {
	const env = options.token
		? { ...process.env, SUPABASE_ACCESS_TOKEN: options.token }
		: process.env;

	const args = [
		"projects",
		"create",
		options.name,
		`--org-id=${options.orgId}`,
		`--region=${options.region}`,
		`--db-password=${options.dbPassword}`,
		"--output",
		"json",
	];

	const result = await exec("supabase", args, { env });

	if (result.exitCode !== 0) {
		throw new Error(`Failed to create Supabase project: ${result.stderr}`);
	}

	try {
		const project = JSON.parse(result.stdout);
		return { projectRef: project.id };
	} catch {
		// Try to extract from stderr/stdout
		const refMatch = result.stdout.match(/[a-z]{20}/);
		if (refMatch) {
			return { projectRef: refMatch[0] };
		}
		throw new Error("Failed to parse Supabase project creation response");
	}
}

export async function supabaseLink(options: {
	projectRef: string;
	dbPassword: string;
	cwd: string;
	token?: string;
}): Promise<void> {
	const env = options.token
		? { ...process.env, SUPABASE_ACCESS_TOKEN: options.token }
		: process.env;

	const args = [
		"link",
		`--project-ref=${options.projectRef}`,
		`--password=${options.dbPassword}`,
	];

	const result = await exec("supabase", args, { cwd: options.cwd, env });

	if (result.exitCode !== 0) {
		throw new Error(`Failed to link Supabase project: ${result.stderr}`);
	}
}

export interface SupabaseBranch {
	id: string;
	name: string;
	status: string;
}

export async function supabaseBranchesList(options: {
	cwd: string;
	token?: string;
}): Promise<SupabaseBranch[]> {
	const env = options.token
		? { ...process.env, SUPABASE_ACCESS_TOKEN: options.token }
		: process.env;

	const result = await exec(
		"supabase",
		["branches", "list", "--output", "json"],
		{
			cwd: options.cwd,
			env,
		},
	);

	if (result.exitCode !== 0) {
		return [];
	}

	try {
		return JSON.parse(result.stdout) as SupabaseBranch[];
	} catch {
		return [];
	}
}

export async function supabaseBranchCreate(options: {
	name: string;
	cwd: string;
	token?: string;
	projectRef?: string;
	persistent?: boolean;
}): Promise<{ branchId: string }> {
	const env = options.token
		? { ...process.env, SUPABASE_ACCESS_TOKEN: options.token }
		: process.env;

	const args = ["branches", "create", options.name];

	if (options.projectRef) {
		args.push("--project-ref", options.projectRef);
	}

	if (options.persistent) {
		args.push("--persistent");
	}

	args.push("--output", "json");

	const result = await exec("supabase", args, { cwd: options.cwd, env });

	if (result.exitCode !== 0) {
		throw new Error(`Failed to create Supabase branch: ${result.stderr}`);
	}

	try {
		const branch = JSON.parse(result.stdout);
		return { branchId: branch.id };
	} catch {
		return { branchId: "unknown" };
	}
}

export async function supabaseProjectApiKeys(options: {
	projectRef: string;
	token?: string;
}): Promise<{ anonKey: string; serviceRoleKey: string }> {
	const env = options.token
		? { ...process.env, SUPABASE_ACCESS_TOKEN: options.token }
		: process.env;

	const result = await exec(
		"supabase",
		[
			"projects",
			"api-keys",
			"--project-ref",
			options.projectRef,
			"--output",
			"json",
		],
		{ env },
	);

	if (result.exitCode !== 0) {
		throw new Error(`Failed to get Supabase API keys: ${result.stderr}`);
	}

	try {
		const keys = JSON.parse(result.stdout) as Array<{
			name: string;
			api_key: string;
		}>;
		const anonKey = keys.find((k) => k.name === "anon")?.api_key || "";
		const serviceRoleKey =
			keys.find((k) => k.name === "service_role")?.api_key || "";
		return { anonKey, serviceRoleKey };
	} catch {
		throw new Error("Failed to parse Supabase API keys");
	}
}

export async function supabaseDbPush(options: {
	cwd: string;
	token?: string;
}): Promise<void> {
	const env = options.token
		? { ...process.env, SUPABASE_ACCESS_TOKEN: options.token }
		: process.env;

	const result = await exec("supabase", ["db", "push", "--include-all"], {
		cwd: options.cwd,
		env,
	});

	if (result.exitCode !== 0) {
		throw new Error(`Failed to push database migrations: ${result.stderr}`);
	}
}

// ============================================================================
// Git operations
// ============================================================================

export async function gitPush(options: {
	cwd: string;
	remote?: string;
	branch?: string;
	setUpstream?: boolean;
}): Promise<void> {
	const args = ["push"];

	if (options.setUpstream) {
		args.push("-u");
	}

	args.push(options.remote || "origin");

	if (options.branch) {
		args.push(options.branch);
	}

	const result = await exec("git", args, { cwd: options.cwd });

	if (result.exitCode !== 0) {
		throw new Error(`Failed to push to remote: ${result.stderr}`);
	}
}

export async function gitRemoteAdd(options: {
	name: string;
	url: string;
	cwd: string;
}): Promise<void> {
	const result = await exec(
		"git",
		["remote", "add", options.name, options.url],
		{
			cwd: options.cwd,
		},
	);

	// Ignore error if remote already exists
	if (result.exitCode !== 0 && !result.stderr.includes("already exists")) {
		throw new Error(`Failed to add git remote: ${result.stderr}`);
	}
}

// ============================================================================
// CLI availability checks
// ============================================================================

export async function isCliInstalled(cli: string): Promise<boolean> {
	try {
		const result = await exec("which", [cli]);
		return result.exitCode === 0;
	} catch {
		return false;
	}
}

export async function checkRequiredClis(): Promise<{
	installed: string[];
	missing: string[];
}> {
	const required = ["gh", "vercel", "supabase", "git", "pnpm"];
	const installed: string[] = [];
	const missing: string[] = [];

	for (const cli of required) {
		if (await isCliInstalled(cli)) {
			installed.push(cli);
		} else {
			missing.push(cli);
		}
	}

	return { installed, missing };
}
