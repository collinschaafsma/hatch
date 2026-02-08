export type BackendProvider = "supabase" | "convex";

export interface CreateOptions {
	projectName: string;
	useWorkOS: boolean;
	useConvex: boolean;
	headless?: HeadlessOptions;
}

export interface TemplateContext {
	projectName: string;
	useWorkOS: boolean;
	useConvex: boolean;
}

// Headless mode types

export interface HeadlessOptions {
	// GitHub
	githubToken?: string;
	githubOrg?: string;

	// Vercel
	vercelToken?: string;
	vercelTeam?: string;

	// Supabase
	supabaseToken?: string;
	supabaseOrg?: string;
	supabaseRegion?: string;

	// Convex
	backendProvider?: BackendProvider;

	// Behavior
	conflictStrategy?: "suffix" | "fail";
	json?: boolean;
	quiet?: boolean;
	bootstrap?: boolean;
	configPath?: string;
}

export interface ClaudeOAuthAccount {
	accountUuid: string;
	emailAddress: string;
	organizationUuid: string;
	displayName?: string;
	organizationName?: string;
	organizationRole?: string;
}

export interface EnvVar {
	key: string;
	value: string;
	environments: ("production" | "preview" | "development")[];
	sensitive?: boolean; // default true, for display purposes
}

export interface ClaudeConfig {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	scopes: string[];
	subscriptionType?: string;
	rateLimitTier?: string;
	oauthAccount?: ClaudeOAuthAccount;
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
	convex?: {
		accessToken?: string;
	};
	claude?: ClaudeConfig;
	envVars?: EnvVar[];
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
	convex?: {
		deploymentUrl: string;
		projectSlug: string;
		deployKey: string;
		deploymentName: string;
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
	supabase?: {
		token: string;
		org: string;
		region: string;
	};
	convex?: {
		accessToken: string;
	};
	backendProvider: BackendProvider;
	conflictStrategy: "suffix" | "fail";
	json: boolean;
	quiet: boolean;
}

// Project types for durable project storage

export interface ProjectRecord {
	name: string; // e.g., "my-app"
	createdAt: string; // ISO timestamp
	backendProvider: BackendProvider;
	github: {
		url: string; // e.g., "https://github.com/org/my-app"
		owner: string;
		repo: string;
	};
	vercel: {
		url: string; // e.g., "https://my-app.vercel.app"
		projectId: string;
	};
	supabase?: {
		projectRef: string;
		region: string;
	};
	convex?: {
		deploymentUrl: string;
		projectSlug: string;
		deployKey: string;
		deploymentName: string;
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
	// Backend-specific fields
	backendProvider?: BackendProvider;
	convexPreviewName?: string; // Deprecated: old preview-based flow
	convexFeatureProject?: {
		projectId: string;
		projectSlug: string; // e.g. "my-app-add-auth"
		deploymentName: string; // e.g. "cool-penguin-123"
		deploymentUrl: string;
		deployKey: string;
	};
	// Spike-specific fields (optional for feature VMs)
	agentSessionId?: string; // For session resume
	spikeStatus?: "running" | "completed" | "failed";
	// Iteration fields (for spike continuations)
	spikeIterations?: number; // Count: 1 = original, 2+ = continued
	originalPrompt?: string; // First prompt for context
	cumulativeCost?: SpikeCost; // Total across iterations
	prUrl?: string; // Store PR URL locally
}

export interface VMStore {
	version: 1;
	vms: VMRecord[];
}

// Spike command types

export interface SpikeOptions {
	project: string;
	prompt: string;
	config?: string;
	timeout?: number;
	wait?: boolean;
}

export interface SpikeCost {
	totalUsd: number;
	inputTokens: number;
	outputTokens: number;
}

export interface SpikeResult {
	status: "started" | "completed" | "failed";
	vmName: string;
	sshHost: string;
	feature: string;
	project: string;
	sessionId?: string;
	monitor?: {
		tailLog: string;
		tailProgress: string;
		checkDone: string;
	};
	prUrl?: string;
	cost?: SpikeCost;
	error?: string;
}
