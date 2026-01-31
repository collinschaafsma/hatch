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

// Project types for durable project storage

export interface ProjectRecord {
	name: string; // e.g., "my-app"
	createdAt: string; // ISO timestamp
	github: {
		url: string; // e.g., "https://github.com/org/my-app"
		owner: string;
		repo: string;
	};
	vercel: {
		url: string; // e.g., "https://my-app.vercel.app"
		projectId: string;
	};
	supabase: {
		projectRef: string;
		region: string;
	};
}

export interface ProjectStore {
	version: 1;
	projects: ProjectRecord[];
}

// VM types for exe.dev integration (ephemeral feature VMs)

export interface VMRecord {
	name: string; // VM name from exe.dev
	sshHost: string; // e.g., "peaceful-duckling.exe.xyz"
	project: string; // Links to ProjectRecord.name
	feature: string; // Feature name (e.g., "add-auth")
	createdAt: string; // ISO timestamp
	supabaseBranches: string[]; // e.g., ["add-auth", "add-auth-test"]
	githubBranch: string; // e.g., "add-auth"
}

export interface VMStore {
	version: 1;
	vms: VMRecord[];
}
