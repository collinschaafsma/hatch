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

export interface HatchConfig {
	github?: {
		org?: string;
		token?: string;
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
