import type { ResolvedHeadlessConfig } from "../types/index.js";
import { log } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import {
	supabaseBranchCreate,
	supabaseBranchesList,
	supabaseLink,
	supabaseProjectApiKeys,
	supabaseProjectCreate,
	supabaseProjectExists,
	supabaseProjectsList,
} from "./cli-wrappers.js";
import { generateDbPassword, resolveNameConflict } from "./conflicts.js";

export interface SupabaseSetupResult {
	projectRef: string;
	projectName: string;
	region: string;
	dbPassword: string;
	anonKey: string;
	serviceRoleKey: string;
	databaseUrl: string;
	wasRenamed: boolean;
	originalName: string;
}

export interface SupabaseBranchResult {
	dev?: string;
	devTest?: string;
}

/**
 * Wait for Supabase project to be ready (ACTIVE_HEALTHY status)
 */
async function waitForProjectReady(
	projectRef: string,
	token: string,
	maxAttempts = 60,
	intervalMs = 5000,
): Promise<void> {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const projects = await supabaseProjectsList(token);
		const project = projects.find((p) => p.id === projectRef);

		if (project?.status === "ACTIVE_HEALTHY") {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	throw new Error(
		`Supabase project ${projectRef} did not become ready within the timeout period`,
	);
}

/**
 * Wait for Supabase branch to be ready
 */
async function waitForBranchReady(
	branchName: string,
	cwd: string,
	token: string,
	maxAttempts = 30,
	intervalMs = 5000,
): Promise<void> {
	const successStatuses = ["ACTIVE_HEALTHY", "FUNCTIONS_DEPLOYED"];
	const failureStatuses = [
		"MIGRATIONS_FAILED",
		"FUNCTIONS_FAILED",
		"INIT_FAILED",
		"REMOVED",
	];

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const branches = await supabaseBranchesList({ cwd, token });
		const branch = branches.find((b) => b.name === branchName);

		if (branch?.status && successStatuses.includes(branch.status)) {
			return;
		}

		if (branch?.status && failureStatuses.includes(branch.status)) {
			throw new Error(
				`Supabase branch ${branchName} failed with status: ${branch.status}`,
			);
		}

		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	throw new Error(
		`Supabase branch ${branchName} did not become ready within the timeout period`,
	);
}

/**
 * Set up Supabase project with conflict resolution
 */
export async function setupSupabase(
	projectName: string,
	projectPath: string,
	config: ResolvedHeadlessConfig,
): Promise<SupabaseSetupResult> {
	const token = config.supabase.token;
	const orgId = config.supabase.org;
	const region = config.supabase.region;

	let supabaseName = projectName;
	let wasRenamed = false;
	const originalName = projectName;

	// Check if project exists and handle conflict
	const exists = await supabaseProjectExists(supabaseName, orgId, token);
	if (exists) {
		if (!config.quiet) {
			log.warn(
				`Supabase project ${supabaseName} already exists in org ${orgId}`,
			);
		}
		supabaseName = resolveNameConflict(supabaseName, config.conflictStrategy);
		wasRenamed = true;
		if (!config.quiet) {
			log.info(`Using ${supabaseName} instead`);
		}
	}

	// Generate database password
	const dbPassword = generateDbPassword();

	// Create the project
	let projectRef: string;

	if (!config.quiet) {
		const result = await withSpinner(
			`Creating Supabase project ${supabaseName}`,
			async () => {
				return supabaseProjectCreate({
					name: supabaseName,
					orgId,
					region,
					dbPassword,
					token,
				});
			},
		);
		projectRef = result.projectRef;
	} else {
		const result = await supabaseProjectCreate({
			name: supabaseName,
			orgId,
			region,
			dbPassword,
			token,
		});
		projectRef = result.projectRef;
	}

	// Wait for project to be ready
	if (!config.quiet) {
		await withSpinner("Waiting for Supabase project to be ready", async () => {
			await waitForProjectReady(projectRef, token);
		});
	} else {
		await waitForProjectReady(projectRef, token);
	}

	// Link the project
	if (!config.quiet) {
		await withSpinner("Linking Supabase project", async () => {
			await supabaseLink({
				projectRef,
				dbPassword,
				cwd: projectPath,
				token,
			});
		});
	} else {
		await supabaseLink({
			projectRef,
			dbPassword,
			cwd: projectPath,
			token,
		});
	}

	// Get API keys
	let anonKey: string;
	let serviceRoleKey: string;

	if (!config.quiet) {
		const keys = await withSpinner("Getting Supabase API keys", async () => {
			return supabaseProjectApiKeys({ projectRef, token });
		});
		anonKey = keys.anonKey;
		serviceRoleKey = keys.serviceRoleKey;
	} else {
		const keys = await supabaseProjectApiKeys({ projectRef, token });
		anonKey = keys.anonKey;
		serviceRoleKey = keys.serviceRoleKey;
	}

	// Construct database URL
	const databaseUrl = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-${region}.pooler.supabase.com:6543/postgres`;

	return {
		projectRef,
		projectName: supabaseName,
		region,
		dbPassword,
		anonKey,
		serviceRoleKey,
		databaseUrl,
		wasRenamed,
		originalName,
	};
}

/**
 * Create Supabase branches (must be called AFTER migrations are run on main)
 * Branches inherit schema from the main project, so migrations must exist first.
 */
export async function createSupabaseBranches(
	projectPath: string,
	projectRef: string,
	config: ResolvedHeadlessConfig,
): Promise<SupabaseBranchResult> {
	const token = config.supabase.token;
	const branches: SupabaseBranchResult = {};

	try {
		if (!config.quiet) {
			const devBranch = await withSpinner(
				"Creating Supabase dev branch",
				async () => {
					return supabaseBranchCreate({
						name: "dev",
						cwd: projectPath,
						token,
						projectRef,
						persistent: true,
					});
				},
			);
			branches.dev = devBranch.branchId;

			const devTestBranch = await withSpinner(
				"Creating Supabase dev-test branch",
				async () => {
					return supabaseBranchCreate({
						name: "dev-test",
						cwd: projectPath,
						token,
						projectRef,
						persistent: true,
					});
				},
			);
			branches.devTest = devTestBranch.branchId;

			// Wait for branches to provision (like the setup script does)
			await withSpinner(
				"Waiting for branches to provision (30 seconds)",
				async () => {
					await new Promise((resolve) => setTimeout(resolve, 30000));
				},
			);
		} else {
			const devBranch = await supabaseBranchCreate({
				name: "dev",
				cwd: projectPath,
				token,
				projectRef,
				persistent: true,
			});
			branches.dev = devBranch.branchId;

			const devTestBranch = await supabaseBranchCreate({
				name: "dev-test",
				cwd: projectPath,
				token,
				projectRef,
				persistent: true,
			});
			branches.devTest = devTestBranch.branchId;

			// Wait for branches to provision
			await new Promise((resolve) => setTimeout(resolve, 30000));
		}
	} catch (error) {
		// Branching might not be enabled (requires Pro plan)
		if (!config.quiet) {
			log.warn(
				"Failed to create Supabase branches. Branching requires a Pro plan.",
			);
		}
	}

	return branches;
}

/**
 * Construct DATABASE_URL for DDL operations (migrations, schema changes)
 * Uses session pooler (aws-1, port 5432) which supports DDL and is IPv4 compatible
 * Note: Transaction pooler (aws-0, port 6543) does NOT support DDL operations
 */
function getDirectDatabaseUrl(
	projectRef: string,
	dbPassword: string,
	region: string,
): string {
	return `postgresql://postgres.${projectRef}:${dbPassword}@aws-1-${region}.pooler.supabase.com:5432/postgres`;
}

/**
 * Run database migrations using Drizzle's db:migrate
 * Must use session pooler (port 5432) for DDL operations
 */
export async function runMigrations(
	projectPath: string,
	projectRef: string,
	dbPassword: string,
	region: string,
	config: ResolvedHeadlessConfig,
): Promise<void> {
	const webPath = `${projectPath}/apps/web`;

	// Use session pooler for DDL operations (migrations)
	const directDbUrl = getDirectDatabaseUrl(projectRef, dbPassword, region);

	if (!config.quiet) {
		await withSpinner("Generating database migrations", async () => {
			const { pnpmRun } = await import("../utils/exec.js");
			await pnpmRun("db:generate", webPath);
		});

		await withSpinner("Applying database migrations", async () => {
			const { execa } = await import("execa");
			await execa("pnpm", ["db:migrate"], {
				cwd: webPath,
				env: { ...process.env, DATABASE_URL: directDbUrl },
			});
		});
	} else {
		const { pnpmRun } = await import("../utils/exec.js");
		const { execa } = await import("execa");

		await pnpmRun("db:generate", webPath);
		await execa("pnpm", ["db:migrate"], {
			cwd: webPath,
			env: { ...process.env, DATABASE_URL: directDbUrl },
		});
	}
}
