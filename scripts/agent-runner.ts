#!/usr/bin/env npx tsx
/**
 * Agent Runner Script
 *
 * This script runs on the VM and uses the Claude Agent SDK to execute
 * autonomous tasks. It outputs structured progress events and results.
 *
 * Usage:
 *   npx tsx agent-runner.ts --prompt "..." --project-path /path --feature name [--resume sessionId]
 *
 * Outputs:
 *   ~/spike.log           - Human-readable log
 *   ~/spike-progress.jsonl - Structured tool use events
 *   ~/session-id.txt      - Session ID for resume
 *   ~/spike-done          - Completion marker
 *   ~/spike-result.json   - Full result with cost/status
 *   ~/pr-url.txt          - PR URL (written by Claude)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { query } from "@anthropic-ai/claude-agent-sdk";

const HOME = process.env.HOME || "/home/exedev";
const LOG_FILE = path.join(HOME, "spike.log");
const PROGRESS_FILE = path.join(HOME, "spike-progress.jsonl");
const SESSION_FILE = path.join(HOME, "session-id.txt");
const DONE_FILE = path.join(HOME, "spike-done");
const RESULT_FILE = path.join(HOME, "spike-result.json");
const CONTEXT_FILE = path.join(HOME, "spike-context.json");
const PR_URL_FILE = path.join(HOME, "pr-url.txt");

interface SpikeIteration {
	prompt: string;
	sessionId?: string;
	timestamp: string;
	cost: { totalUsd: number; inputTokens: number; outputTokens: number };
}

interface SpikeContext {
	feature: string;
	project: string;
	projectPath: string;
	prUrl?: string;
	iterations: SpikeIteration[];
}

interface ProgressEvent {
	timestamp: string;
	type: "tool_start" | "tool_end" | "message" | "error";
	tool?: string;
	description?: string;
	input?: unknown;
	output?: unknown;
	message?: string;
}

interface CostSnapshot {
	inputTokens: number;
	outputTokens: number;
	totalUsd: number;
}

interface EventPayload {
	seq: number;
	timestamp: string;
	type: "tool_start" | "tool_end" | "message" | "error";
	tool?: string;
	description?: string;
	message?: string;
	costSnapshot?: CostSnapshot;
}

interface StartRunPayload {
	vmName: string;
	sshHost: string;
	feature: string;
	project: string;
	prompt: string;
	iteration: number;
	github: {
		repoUrl: string;
		owner: string;
		repo: string;
		branch: string;
	};
	vercelUrl: string | null;
	convexPreviewDeployment: {
		deploymentUrl: string;
		deploymentName: string;
	} | null;
	previousIterations: SpikeIteration[];
}

interface CompleteRunPayload {
	status: "completed" | "failed";
	cost: CostSnapshot;
	sessionId?: string;
	error?: string;
	pr?: {
		url: string;
		number?: number;
		title?: string;
		state?: string;
		reviewDecision?: string | null;
		mergeable?: string | null;
		checksStatus?: string;
		additions?: number;
		deletions?: number;
		changedFiles?: number;
	};
	planProgress?: { completed: number; total: number };
	durationMs: number;
}

class RemoteLogger {
	private buffer: EventPayload[] = [];
	private flushTimer: NodeJS.Timeout | null = null;
	private consecutiveFailures = 0;
	private disabled = false;
	private seq = 0;
	private runId: string | null = null;
	readonly startTime = Date.now();

	constructor(
		private endpoint: string,
		private token: string,
	) {}

	async startRun(meta: StartRunPayload): Promise<void> {
		try {
			const res = await this.post("/api/runs/start", meta);
			this.runId = res.runId;
		} catch {
			this.disabled = true;
			log(
				"Warning: Remote monitoring unavailable, continuing with local logs only",
			);
		}
	}

	push(event: ProgressEvent, costSnapshot: CostSnapshot): void {
		if (this.disabled || !this.runId) return;

		this.buffer.push({
			seq: this.seq++,
			timestamp: event.timestamp,
			type: event.type,
			tool: event.tool,
			description: event.description,
			message: event.message?.slice(0, 500),
			costSnapshot,
		});

		const isHighPriority = event.type === "error";
		if (isHighPriority || this.buffer.length >= 20) {
			this.flush();
		} else if (!this.flushTimer) {
			this.flushTimer = setTimeout(() => this.flush(), 3000);
		}
	}

	async flush(): Promise<void> {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}
		if (this.buffer.length === 0 || this.disabled || !this.runId) return;

		const events = [...this.buffer];
		this.buffer = [];

		try {
			await this.post("/api/runs/events", { runId: this.runId, events });
			this.consecutiveFailures = 0;
		} catch {
			this.consecutiveFailures++;
			this.buffer = [...events, ...this.buffer];
			if (this.consecutiveFailures >= 3) {
				this.disabled = true;
				this.buffer = [];
				log("Warning: Remote monitoring disabled after 3 failures");
			}
		}
	}

	async completeRun(payload: CompleteRunPayload): Promise<void> {
		await this.flush();
		if (this.disabled || !this.runId) return;

		try {
			await this.post("/api/runs/complete", { runId: this.runId, ...payload });
		} catch {
			log("Warning: Failed to send completion to remote monitor");
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: HTTP response shape varies per endpoint
	private async post(path: string, body: unknown): Promise<any> {
		const res = await fetch(`${this.endpoint}${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.token}`,
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(10_000),
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}
}

function describeToolUse(name: string, input: Record<string, unknown>): string {
	switch (name) {
		case "Read":
			return `Reading ${input.file_path || "file"}`;
		case "Edit":
			return `Editing ${input.file_path || "file"}`;
		case "Write":
			return `Writing ${input.file_path || "file"}`;
		case "Bash": {
			const cmd = String(input.command || "");
			return `Running: ${cmd.slice(0, 80)}${cmd.length > 80 ? "..." : ""}`;
		}
		case "Glob":
			return `Searching for ${input.pattern || "files"}`;
		case "Grep":
			return `Searching for "${input.pattern || "pattern"}"`;
		default:
			return `Using ${name}`;
	}
}

function log(message: string): void {
	const timestamp = new Date().toISOString();
	const line = `[${timestamp}] ${message}\n`;
	fs.appendFileSync(LOG_FILE, line);
	console.log(message);
}

// Initialized in main() if HATCH_MONITOR_URL is set
let remoteLogger: RemoteLogger | null = null;
let totalInputTokens = 0;
let totalOutputTokens = 0;

function currentCostUsd(): number {
	const inputCost = (totalInputTokens / 1_000_000) * 3;
	const outputCost = (totalOutputTokens / 1_000_000) * 15;
	return inputCost + outputCost;
}

function logProgress(event: ProgressEvent): void {
	fs.appendFileSync(PROGRESS_FILE, `${JSON.stringify(event)}\n`);
	remoteLogger?.push(event, {
		inputTokens: totalInputTokens,
		outputTokens: totalOutputTokens,
		totalUsd: currentCostUsd(),
	});
}

function writeResult(result: {
	status: "completed" | "failed";
	sessionId?: string;
	cost?: { totalUsd: number; inputTokens: number; outputTokens: number };
	error?: string;
}): void {
	fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 2));
	fs.writeFileSync(DONE_FILE, "done");
}

function loadContext(): SpikeContext | null {
	try {
		if (fs.existsSync(CONTEXT_FILE)) {
			return JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf-8"));
		}
	} catch {
		// Corrupted or missing, start fresh
	}
	return null;
}

function saveContext(context: SpikeContext): void {
	fs.writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2));
}

function loadPrUrl(): string | undefined {
	try {
		if (fs.existsSync(PR_URL_FILE)) {
			return fs.readFileSync(PR_URL_FILE, "utf-8").trim() || undefined;
		}
	} catch {
		// Missing
	}
	return undefined;
}

const HATCH_SPIKE_NAME = process.env.HATCH_SPIKE_NAME || "";

const OBSERVABILITY_INSTRUCTIONS = `
## Observability

This project has structured logging. Use these commands to verify your changes:
- \`pnpm harness:logs:clear\` — Clear logs before testing for a clean window
- \`pnpm harness:logs\` — See recent log entries
- \`pnpm harness:logs --level error\` — Check for errors
- \`pnpm harness:logs --slow 200\` — Find slow requests
- \`pnpm harness:logs --summary\` — Aggregate stats by route
`;

const CONVEX_INSTRUCTIONS = `
## Convex Development

After modifying any Convex schema or function files (anything in the convex/ directory), you MUST run:

\`\`\`bash
cd apps/web && npx convex dev --once
\`\`\`

This pushes your schema/function changes to the running Convex backend and regenerates the \`convex/_generated/\` types. You must do this BEFORE running typechecking, as the generated types will be stale otherwise.

Do NOT skip this step — uncommitted Convex changes will not be reflected in the backend until you run this command.
`;

async function main(): Promise<void> {
	// Pre-flight: ensure ANTHROPIC_API_KEY is set
	if (!process.env.ANTHROPIC_API_KEY) {
		const errorMessage =
			"ANTHROPIC_API_KEY environment variable is not set. Run 'hatch config' to configure your API key.";
		console.error(errorMessage);
		writeResult({ status: "failed", error: errorMessage });
		process.exit(1);
	}

	const { values } = parseArgs({
		options: {
			prompt: { type: "string" },
			"project-path": { type: "string" },
			feature: { type: "string" },
			project: { type: "string" },
			resume: { type: "string" },
		},
	});

	const prompt = values.prompt;
	const projectPath = values["project-path"];
	const feature = values.feature;
	const project = values.project || "";
	const resumeSessionId = values.resume;

	if (!prompt || !projectPath || !feature) {
		console.error(
			"Usage: npx tsx agent-runner.ts --prompt <prompt> --project-path <path> --feature <name> [--project <name>] [--resume <sessionId>]",
		);
		process.exit(1);
	}

	// Initialize log files
	fs.writeFileSync(LOG_FILE, "");
	fs.writeFileSync(PROGRESS_FILE, "");

	// Load existing context (for iterations)
	const existingContext = loadContext();
	const existingPrUrl = loadPrUrl();
	const isIteration =
		existingContext !== null && existingContext.iterations.length > 0;

	log(
		`Starting spike: ${feature}${isIteration ? ` (iteration ${existingContext.iterations.length + 1})` : ""}`,
	);
	log(`Project path: ${projectPath}`);
	log(`Prompt: ${prompt}`);
	if (existingPrUrl) {
		log(`Existing PR: ${existingPrUrl}`);
	}
	if (resumeSessionId) {
		log(`Resuming session: ${resumeSessionId}`);
	}

	// Initialize remote logger if configured
	if (process.env.HATCH_MONITOR_URL && process.env.HATCH_MONITOR_TOKEN) {
		remoteLogger = new RemoteLogger(
			process.env.HATCH_MONITOR_URL,
			process.env.HATCH_MONITOR_TOKEN,
		);
		await remoteLogger.startRun({
			vmName: process.env.HATCH_VM_NAME || "unknown",
			sshHost: process.env.HATCH_SSH_HOST || "unknown",
			feature,
			project,
			prompt,
			iteration: existingContext ? existingContext.iterations.length + 1 : 1,
			github: {
				repoUrl: process.env.HATCH_GITHUB_REPO_URL || "",
				owner: process.env.HATCH_GITHUB_OWNER || "",
				repo: process.env.HATCH_GITHUB_REPO || "",
				branch: feature,
			},
			vercelUrl: process.env.HATCH_VERCEL_URL || null,
			convexPreviewDeployment: process.env.HATCH_CONVEX_PREVIEW_URL
				? {
						deploymentUrl: process.env.HATCH_CONVEX_PREVIEW_URL,
						deploymentName: process.env.HATCH_CONVEX_PREVIEW_NAME || "",
					}
				: null,
			previousIterations: existingContext?.iterations || [],
		});
	}

	// Build the full prompt with instructions
	let fullPrompt: string;

	if (isIteration && existingPrUrl) {
		// Continuation prompt - don't create new PR
		const previousWork = existingContext.iterations
			.map(
				(iter, i) =>
					`- Iteration ${i + 1}: "${iter.prompt}" (completed ${iter.timestamp})`,
			)
			.join("\n");

		const planContinuation = HATCH_SPIKE_NAME
			? `Read the existing execution plan at docs/plans/${HATCH_SPIKE_NAME}.md. Compare it against the current request below. If the request changes scope or direction, update the plan first — mark obsolete steps as ~struck through~, add new steps, and commit the updated plan before coding. Otherwise, continue from the first unchecked step.\n\n`
			: "";

		fullPrompt = `${planContinuation}You are continuing work on feature "${feature}".

Previous work:
${previousWork}

A PR already exists at: ${existingPrUrl}

For this iteration, add new commits to the existing branch and push.
Do NOT create a new PR - the existing one will update automatically.

Current request: ${prompt}

When you are done implementing your changes:
1. Run \`pnpm lint\` from the project root and fix any lint errors
2. Run \`pnpm typecheck\` from the project root and fix any type errors
3. Run the test suite to verify your changes don't break existing tests — if tests need updates, fix them
4. If you changed any UI files (files matching \`apps/web/app/**/*.tsx\` or \`packages/ui/**/*.tsx\`), capture visual evidence:
   a. Start the dev server in the background: \`cd apps/web && pnpm dev &\` and wait for it to be ready (curl localhost:3000 in a loop)
   b. Run \`pnpm harness:ui:capture-browser-evidence\` to screenshot affected routes
   c. Stop the dev server: \`kill %1\`
5. Commit all changes with a descriptive message
6. If you captured evidence in step 4, commit the screenshots in a separate commit:
   a. Run: \`git add -f .harness/evidence/ && git commit -m "chore: add UI evidence screenshots"\`
   b. Verify the commit contains evidence files: \`git show --stat HEAD\` — you must see .harness/evidence/ files listed. If not, the evidence was not committed and you need to fix it before proceeding.
7. Push the branch to origin (the PR will update automatically)
8. If you captured evidence in step 4, post it as a PR comment: \`pnpm harness:ui:post-evidence\`

Important: The branch already exists (${feature}). Make your changes, verify quality, commit, and push.`;
	} else {
		// First iteration - create PR
		const planPreamble = HATCH_SPIKE_NAME
			? `PLANNING MODE: Before writing any code, create an execution plan.

1. Read docs/plans/_template.md for the plan format
2. Read docs/architecture.md and docs/patterns.md for project context
3. Create docs/plans/${HATCH_SPIKE_NAME}.md with your plan
4. Commit the plan: git add docs/plans/${HATCH_SPIKE_NAME}.md && git commit -m "plan: ${HATCH_SPIKE_NAME}"
5. Execute each step in order. After completing each step:
   - Check the box in the plan
   - Add any decisions to the Decision Log
   - Commit the plan update with your code changes
6. When all steps are done, update the plan status to "completed"
7. Use observability commands (pnpm harness:logs:errors, pnpm harness:logs --slow 500, pnpm harness:logs:summary) to verify each step and complete the Observability Checklist

Your task:
`
			: "";

		fullPrompt = `${planPreamble}${prompt}

When you are done implementing your changes:
1. Run \`pnpm lint\` from the project root and fix any lint errors
2. Run \`pnpm typecheck\` from the project root and fix any type errors
3. Run the test suite to verify your changes don't break existing tests — if tests need updates, fix them
4. If you changed any UI files (files matching \`apps/web/app/**/*.tsx\` or \`packages/ui/**/*.tsx\`), capture visual evidence:
   a. Start the dev server in the background: \`cd apps/web && pnpm dev &\` and wait for it to be ready (curl localhost:3000 in a loop)
   b. Run \`pnpm harness:ui:capture-browser-evidence\` to screenshot affected routes
   c. Stop the dev server: \`kill %1\`
5. Commit all changes with a descriptive message
6. If you captured evidence in step 4, commit the screenshots in a separate commit:
   a. Run: \`git add -f .harness/evidence/ && git commit -m "chore: add UI evidence screenshots"\`
   b. Verify the commit contains evidence files: \`git show --stat HEAD\` — you must see .harness/evidence/ files listed. If not, the evidence was not committed and you need to fix it before proceeding.
7. Push the branch to origin
8. Create a pull request using 'gh pr create'
9. Write the PR URL to ~/pr-url.txt (just the URL, nothing else)
10. If you captured evidence in step 4, post it as a PR comment: \`pnpm harness:ui:post-evidence\`

Important: The branch is already created (${feature}). Make your changes, verify quality, then commit, push, and create the PR.`;
	}

	fullPrompt += `\n${OBSERVABILITY_INSTRUCTIONS}`;
	fullPrompt += `\n${CONVEX_INSTRUCTIONS}`;

	// Reset module-level counters for this run
	totalInputTokens = 0;
	totalOutputTokens = 0;
	let sessionId: string | undefined;

	try {
		// Run the agent
		const result = await query({
			prompt: fullPrompt,
			options: {
				cwd: projectPath,
				allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
				maxTurns: 10000,
			},
			abortController: new AbortController(),
		});

		// Process messages to extract info
		for await (const message of result) {
			// Track session ID (log only once)
			if ("session_id" in message && message.session_id) {
				if (!sessionId) {
					sessionId = message.session_id as string;
					fs.writeFileSync(SESSION_FILE, sessionId);
					log(`Session ID: ${sessionId}`);
				}
			}

			// Track usage
			if ("usage" in message && message.usage) {
				const usage = message.usage as {
					input_tokens?: number;
					output_tokens?: number;
				};
				if (usage.input_tokens) totalInputTokens += usage.input_tokens;
				if (usage.output_tokens) totalOutputTokens += usage.output_tokens;
			}

			// Log tool use summaries
			if (message.type === "tool_use_summary") {
				const msg = message as {
					type: string;
					summary?: string;
					tool_name?: string;
				};
				const summary = msg.summary || "Tool completed";
				log(summary);
				logProgress({
					timestamp: new Date().toISOString(),
					type: "tool_end",
					tool: msg.tool_name,
					description: summary,
				});
			}

			// Log tool progress
			if (message.type === "tool_progress") {
				const msg = message as {
					type: string;
					tool_name?: string;
					elapsed_time_seconds?: number;
				};
				if (msg.tool_name) {
					log(
						`Running ${msg.tool_name}...${msg.elapsed_time_seconds ? ` (${msg.elapsed_time_seconds}s)` : ""}`,
					);
				}
			}

			// Log assistant messages (contains tool_use content blocks)
			if (message.type === "assistant") {
				const msg = message as {
					type: string;
					message?: {
						content?: Array<{
							type: string;
							name?: string;
							input?: Record<string, unknown>;
							text?: string;
						}>;
					};
				};
				const content = msg.message?.content;
				if (Array.isArray(content)) {
					for (const block of content) {
						if (block.type === "tool_use" && block.name) {
							const description = describeToolUse(
								block.name,
								block.input || {},
							);
							log(description);
							logProgress({
								timestamp: new Date().toISOString(),
								type: "tool_start",
								tool: block.name,
								description,
								input: block.input,
							});
						}
						if (block.type === "text" && block.text?.trim()) {
							log(
								`Claude: ${block.text.slice(0, 500)}${block.text.length > 500 ? "..." : ""}`,
							);
							logProgress({
								timestamp: new Date().toISOString(),
								type: "message",
								message: block.text,
							});
						}
					}
				}
			}

			// Log result
			if (message.type === "result") {
				log("Agent completed");
				logProgress({
					timestamp: new Date().toISOString(),
					type: "message",
					message: "Agent run completed",
				});
			}
		}

		// Calculate cost (Claude pricing: $3/$15 per 1M tokens for Sonnet)
		const inputCost = (totalInputTokens / 1_000_000) * 3;
		const outputCost = (totalOutputTokens / 1_000_000) * 15;
		const totalUsd = inputCost + outputCost;

		log("Completed successfully");
		log(
			`Tokens: ${totalInputTokens} input, ${totalOutputTokens} output (~$${totalUsd.toFixed(4)})`,
		);

		// Update context file with this iteration
		const currentCost = {
			totalUsd,
			inputTokens: totalInputTokens,
			outputTokens: totalOutputTokens,
		};

		const newIteration: SpikeIteration = {
			prompt,
			sessionId,
			timestamp: new Date().toISOString(),
			cost: currentCost,
		};

		const updatedContext: SpikeContext = existingContext
			? {
					...existingContext,
					prUrl: loadPrUrl() || existingContext.prUrl,
					iterations: [...existingContext.iterations, newIteration],
				}
			: {
					feature,
					project,
					projectPath,
					prUrl: loadPrUrl(),
					iterations: [newIteration],
				};

		saveContext(updatedContext);

		writeResult({
			status: "completed",
			sessionId,
			cost: currentCost,
		});

		// Send completion to remote monitor
		if (remoteLogger) {
			const prUrl = loadPrUrl();
			let prData: CompleteRunPayload["pr"] = undefined;
			if (prUrl) {
				try {
					const { execaCommand } = await import("execa");
					const { stdout } = await execaCommand(
						`gh pr view ${prUrl} --json number,title,state,reviewDecision,mergeable,statusCheckRollup,additions,deletions,changedFiles`,
						{
							env: {
								...process.env,
								...(process.env.GH_TOKEN
									? { GH_TOKEN: process.env.GH_TOKEN }
									: {}),
							},
						},
					);
					const ghData = JSON.parse(stdout);
					const checksRollup = ghData.statusCheckRollup as
						| Array<{ conclusion?: string; status?: string }>
						| undefined;
					let checksStatus: string | undefined;
					if (checksRollup && checksRollup.length > 0) {
						const hasFail = checksRollup.some(
							(c) => c.conclusion === "FAILURE" || c.conclusion === "ERROR",
						);
						const hasPending = checksRollup.some(
							(c) => c.status === "IN_PROGRESS" || c.status === "QUEUED",
						);
						checksStatus = hasFail ? "fail" : hasPending ? "pending" : "pass";
					}
					prData = {
						url: prUrl,
						number: ghData.number,
						title: ghData.title,
						state: ghData.state,
						reviewDecision: ghData.reviewDecision || null,
						mergeable: ghData.mergeable || null,
						checksStatus,
						additions: ghData.additions,
						deletions: ghData.deletions,
						changedFiles: ghData.changedFiles,
					};
				} catch {
					prData = { url: prUrl };
				}
			}

			let planProgress: CompleteRunPayload["planProgress"] = undefined;
			const planPath = path.join(projectPath, `docs/plans/${feature}.md`);
			if (fs.existsSync(planPath)) {
				const planContent = fs.readFileSync(planPath, "utf-8");
				const completed = (planContent.match(/- \[x\]/gi) || []).length;
				const total = completed + (planContent.match(/- \[ \]/g) || []).length;
				planProgress = { completed, total };
			}

			await remoteLogger.completeRun({
				status: "completed",
				cost: currentCost,
				sessionId,
				pr: prData,
				planProgress,
				durationMs: Date.now() - remoteLogger.startTime,
			});
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log(`Error: ${errorMessage}`);
		logProgress({
			timestamp: new Date().toISOString(),
			type: "error",
			message: errorMessage,
		});

		const failCost = {
			totalUsd: currentCostUsd(),
			inputTokens: totalInputTokens,
			outputTokens: totalOutputTokens,
		};

		writeResult({
			status: "failed",
			sessionId,
			error: errorMessage,
			cost: totalInputTokens > 0 ? failCost : undefined,
		});

		if (remoteLogger) {
			await remoteLogger.completeRun({
				status: "failed",
				cost: failCost,
				sessionId,
				error: errorMessage,
				durationMs: Date.now() - remoteLogger.startTime,
			});
		}

		process.exit(1);
	}
}

main();
