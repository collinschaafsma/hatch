export function generateExampleWorkflow(): string {
	return `import { generateText } from "ai";
import { fetch, getWritable, sleep } from "workflow";
import {
	WORKFLOW_PROGRESS_MESSAGES,
	WORKFLOW_STREAM_NAMESPACE,
	WORKFLOW_TOTAL_STEPS,
	type WorkflowProgressEvent,
	type WorkflowStep,
} from "@/lib/workflow-progress/types";

// Step keys in order - used to derive step number from position
const STEP_KEYS = Object.keys(WORKFLOW_PROGRESS_MESSAGES) as WorkflowStep[];

/**
 * Emit a progress event to the workflow stream.
 * This is a step function because getWritable() must be called from within a step.
 */
async function emitProgress(
	step: WorkflowStep | "error",
	type: WorkflowProgressEvent["type"] = "progress",
	data?: WorkflowProgressEvent["data"],
): Promise<void> {
	"use step";

	const writable = getWritable<WorkflowProgressEvent>({
		namespace: WORKFLOW_STREAM_NAMESPACE,
	});
	const writer = writable.getWriter();

	const stepNumber = step === "error" ? 0 : STEP_KEYS.indexOf(step) + 1;
	const message =
		step === "error"
			? "An error occurred"
			: WORKFLOW_PROGRESS_MESSAGES[step];

	await writer.write({
		type,
		step: stepNumber,
		totalSteps: WORKFLOW_TOTAL_STEPS,
		message,
		timestamp: new Date().toISOString(),
		data,
	});

	writer.releaseLock();
}

/**
 * AI Agent Workflow
 *
 * This workflow demonstrates streaming progress events to the frontend
 * while processing an AI request. Each step emits a progress event
 * that the UI can consume in real-time.
 *
 * @param prompt - The user's prompt for the AI agent
 * @returns The AI-generated response
 */
export async function aiAgentWorkflow(prompt: string): Promise<string> {
	"use workflow";

	globalThis.fetch = fetch;

	try {
		// Step 1: Initialize
		await emitProgress("initializing");
		await initializeWorkflow();

		// Step 2: Analyze prompt
		await emitProgress("analyzing");
		const processedPrompt = await analyzePrompt(prompt);

		// Step 3: Generate AI response
		await emitProgress("generating");
		const response = await generateAIResponse(processedPrompt);

		// Step 4: Process results
		await emitProgress("processing");
		const processedResponse = await processResults(response);

		// Step 5: Finalize
		await emitProgress("finalizing", "completed", { result: processedResponse });

		return processedResponse;
	} catch (error) {
		await emitProgress("error", "error", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
		throw error;
	}
}

async function initializeWorkflow(): Promise<void> {
	"use step";
	// Simulate initialization delay
	await sleep("500ms");
}

async function analyzePrompt(prompt: string): Promise<string> {
	"use step";
	// Add any preprocessing logic here
	await sleep("300ms");
	return \`User request: \${prompt}\`;
}

async function generateAIResponse(prompt: string): Promise<string> {
	"use step";

	const result = await generateText({
		model: "openai/gpt-4o-mini",
		prompt,
		system: "You are a helpful AI assistant. Be concise and helpful.",
	});

	return result.text;
}

async function processResults(response: string): Promise<string> {
	"use step";
	// Add any post-processing logic here
	await sleep("200ms");
	return response;
}
`;
}
