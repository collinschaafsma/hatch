export function generateWorkflowProgressTypes(): string {
	return `/**
 * Types for workflow progress streaming
 *
 * Used to emit and consume real-time progress events from workflows
 * to display status updates in the UI.
 */

/**
 * Progress event emitted by workflow steps
 */
export interface WorkflowProgressEvent {
	type: "progress" | "completed" | "error";
	step: number;
	totalSteps: number;
	message: string;
	timestamp: string;
	data?: {
		result?: string;
		error?: string;
	};
}

/**
 * High-level progress messages for each workflow step.
 * Uses semantic keys for better readability and easier maintenance.
 */
export const WORKFLOW_PROGRESS_MESSAGES = {
	initializing: "Initializing workflow...",
	analyzing: "Analyzing your prompt...",
	generating: "Generating AI response...",
	processing: "Processing results...",
	finalizing: "Finalizing...",
} as const;

export type WorkflowStep = keyof typeof WORKFLOW_PROGRESS_MESSAGES;

/**
 * Total number of steps in the workflow
 */
export const WORKFLOW_TOTAL_STEPS = 5;

/**
 * Namespace used for progress stream
 */
export const WORKFLOW_STREAM_NAMESPACE = "ai-workflow-progress";
`;
}
