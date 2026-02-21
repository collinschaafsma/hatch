export interface CreateOptions {
	projectName: string;
	headless?: HeadlessOptions;
}

export interface TemplateContext {
	projectName: string;
}

// Headless mode types

export interface HeadlessOptions {
	// GitHub
	githubToken?: string;
	githubOrg?: string;

	// Vercel
	vercelToken?: string;
	vercelTeam?: string;

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
	project?: string;
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
	convex: {
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
	convex: {
		accessToken: string;
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
	convex: {
		deploymentUrl: string;
		projectSlug: string;
		deployKey: string;
		deploymentName: string;
		previewDeployKey?: string;
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
	githubBranch: string; // e.g., "add-auth"
	convexFeatureProject?: {
		projectId: string;
		projectSlug: string; // e.g. "my-app-add-auth"
		deploymentName: string; // e.g. "cool-penguin-123"
		deploymentUrl: string;
		deployKey: string;
	};
	convexPreviewDeployment?: {
		deploymentUrl: string; // e.g. "https://happy-animal-123.convex.cloud"
		deploymentName: string; // e.g. "happy-animal-123"
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

export interface PRStatus {
	number: number;
	title: string;
	url: string;
	state: "OPEN" | "MERGED" | "CLOSED";
	reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
	mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
	checksStatus: "pass" | "fail" | "pending";
	checksDetail: Array<{ name: string; status: string; conclusion: string }>;
}

export interface VMStatus {
	vmName: string;
	feature: string;
	project: string;
	sshHost: string;
	githubBranch: string;
	vmReachable: boolean;
	spike: {
		status: "running" | "completed" | "failed";
		iterations: number;
		originalPrompt: string | null;
		cumulativeCost: SpikeCost | null;
		createdAgo: string;
		createdAt: string;
		spikeActuallyDone: boolean | null;
		planProgress: { completed: number; total: number } | null;
	} | null;
	pr: PRStatus | null;
}

export interface StatusResult {
	timestamp: string;
	project: string | null;
	vms: VMStatus[];
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
