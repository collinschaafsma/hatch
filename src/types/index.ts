export interface CreateOptions {
	projectName: string;
	useWorkOS: boolean;
	headless?: HeadlessOptions;
}

export interface TemplateContext {
	projectName: string;
	useWorkOS: boolean;
}

// Headless mode types

export interface HeadlessOptions {
	// GitHub
	githubToken?: string;
	githubOrg?: string;

	// Vercel
	vercelToken?: string;
	vercelTeam: string;

	// Supabase
	supabaseToken?: string;
	supabaseOrg: string;
	supabaseRegion: string;

	// Behavior
	conflictStrategy: "suffix" | "fail";
	json: boolean;
	quiet: boolean;
	bootstrap: boolean;
	configPath?: string;
}

export interface ClaudeConfig {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	scopes: string[];
	subscriptionType?: string;
	rateLimitTier?: string;
}

export interface HatchConfig {
	github?: {
		org?: string;
		token?: string;
		email?: string;
		name?: string;
	};
	vercel?: {
		team?: string;
		token?: string;
	};
	supabase?: {
		org?: string;
		region?: string;
		token?: string;
	};
	claude?: ClaudeConfig;
}

export interface HeadlessResult {
	success: boolean;
	error?: string;
	project?: {
		name: string;
		path: string;
	};
	github?: {
		url: string;
		owner: string;
		repo: string;
	};
	vercel?: {
		url: string;
		projectId: string;
		projectName: string;
	};
	supabase?: {
		projectRef: string;
		region: string;
		projectName: string;
	};
	nextSteps?: string[];
}

export interface ResolvedHeadlessConfig {
	github: {
		token: string;
		org?: string;
		email?: string;
		name?: string;
	};
	vercel: {
		token: string;
		team: string;
	};
	supabase: {
		token: string;
		org: string;
		region: string;
	};
	conflictStrategy: "suffix" | "fail";
	json: boolean;
	quiet: boolean;
}

// VM types for exe.dev integration

export interface VMRecord {
	name: string; // e.g., "peaceful-duckling"
	sshHost: string; // e.g., "peaceful-duckling.exe.xyz"
	project: string; // e.g., "my-app"
	feature?: string; // e.g., "add-user-profiles"
	createdAt: string; // ISO timestamp
	supabaseBranches: string[]; // e.g., ["add-user-profiles", "add-user-profiles-test"]
	githubBranch?: string; // e.g., "add-user-profiles"
}

export interface VMStore {
	version: 1;
	vms: VMRecord[];
}
