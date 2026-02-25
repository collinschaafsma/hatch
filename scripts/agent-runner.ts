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
	input?: unknown;
	output?: unknown;
	message?: string;
}

function log(message: string): void {
	const timestamp = new Date().toISOString();
	const line = `[${timestamp}] ${message}\n`;
	fs.appendFileSync(LOG_FILE, line);
	console.log(message);
}

function logProgress(event: ProgressEvent): void {
	fs.appendFileSync(PROGRESS_FILE, `${JSON.stringify(event)}\n`);
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
			? `Read docs/plans/${HATCH_SPIKE_NAME}.md for the existing execution plan. Continue from the first unchecked step.\n\n`
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

	let totalInputTokens = 0;
	let totalOutputTokens = 0;
	let sessionId: string | undefined;

	try {
		// Run the agent
		const result = await query({
			prompt: fullPrompt,
			options: {
				cwd: projectPath,
				allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
				maxTurns: 100,
			},
			abortController: new AbortController(),
		});

		// Process messages to extract info
		for await (const message of result) {
			// Track session ID
			if ("session_id" in message && message.session_id) {
				sessionId = message.session_id as string;
				fs.writeFileSync(SESSION_FILE, sessionId);
				log(`Session ID: ${sessionId}`);
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

			// Log tool use
			if (message.type === "tool_use") {
				const toolName = (message as { name?: string }).name || "unknown";
				log(`Tool: ${toolName}`);
				logProgress({
					timestamp: new Date().toISOString(),
					type: "tool_start",
					tool: toolName,
					input: (message as { input?: unknown }).input,
				});
			}

			// Log tool results
			if (message.type === "tool_result") {
				logProgress({
					timestamp: new Date().toISOString(),
					type: "tool_end",
					output:
						typeof (message as { content?: unknown }).content === "string"
							? (message as { content: string }).content.slice(0, 500)
							: "[binary or complex output]",
				});
			}

			// Log text messages
			if (message.type === "text") {
				const text = (message as { text?: string }).text || "";
				if (text.trim()) {
					log(`Claude: ${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`);
					logProgress({
						timestamp: new Date().toISOString(),
						type: "message",
						message: text,
					});
				}
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
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log(`Error: ${errorMessage}`);
		logProgress({
			timestamp: new Date().toISOString(),
			type: "error",
			message: errorMessage,
		});

		writeResult({
			status: "failed",
			sessionId,
			error: errorMessage,
			cost:
				totalInputTokens > 0
					? {
							totalUsd:
								(totalInputTokens / 1_000_000) * 3 +
								(totalOutputTokens / 1_000_000) * 15,
							inputTokens: totalInputTokens,
							outputTokens: totalOutputTokens,
						}
					: undefined,
		});

		process.exit(1);
	}
}

main();
