export function generateUseWorkflowProgress(): string {
	return `"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WORKFLOW_TOTAL_STEPS } from "@/lib/workflow-progress/types";

/**
 * Progress event structure from the workflow SSE stream
 */
interface ProgressEvent {
	type: "progress" | "completed" | "error";
	step: number;
	totalSteps: number;
	message: string;
	data?: {
		result?: string;
		error?: string;
	};
}

/**
 * State machine for workflow progress
 */
export type WorkflowState =
	| { status: "idle" }
	| {
			status: "generating";
			runId: string;
			step: number;
			totalSteps: number;
			message: string;
	  }
	| { status: "completed"; result: string }
	| { status: "error"; error: string };

/**
 * Return type for the workflow progress hook
 */
export interface UseWorkflowProgressReturn {
	/** Current state of the workflow */
	state: WorkflowState;
	/** Start tracking a workflow - pass runId from your action result */
	startWithRunId: (runId: string) => void;
	/** Set error state (e.g., when action fails before workflow starts) */
	setError: (error: string) => void;
	/** Reset state to idle */
	reset: () => void;
}

/**
 * Hook for consuming workflow progress events via SSE
 *
 * Tracks progress for the current page session only. If the user refreshes,
 * progress is lost but the workflow continues server-side.
 *
 * @example
 * \`\`\`tsx
 * const { state, startWithRunId } = useWorkflowProgress();
 *
 * const handleStart = async () => {
 *   const response = await fetch("/api/workflow", {
 *     method: "POST",
 *     body: JSON.stringify({ prompt }),
 *   });
 *   const { runId } = await response.json();
 *   startWithRunId(runId);
 * };
 * \`\`\`
 */
export function useWorkflowProgress(): UseWorkflowProgressReturn {
	const [state, setState] = useState<WorkflowState>({ status: "idle" });

	const abortControllerRef = useRef<AbortController | null>(null);
	const isMountedRef = useRef(true);
	const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Reset mounted ref on every render (handles Strict Mode remounts)
	isMountedRef.current = true;

	// Connect to the workflow progress SSE stream
	const connectToStream = useCallback(async (runId: string, retryCount = 0) => {
		const abortController = new AbortController();
		abortControllerRef.current = abortController;

		try {
			const response = await fetch(\`/api/workflow-progress/\${runId}\`, {
				signal: abortController.signal,
			});

			if (!response.ok) {
				if (response.status === 404) {
					// Workflow not found - may not be ready yet after start()
					const maxRetries = 3;
					if (retryCount < maxRetries) {
						const delay = Math.min(500 * 2 ** retryCount, 2000);
						await new Promise((resolve) => setTimeout(resolve, delay));
						return connectToStream(runId, retryCount + 1);
					}
					setState({ status: "idle" });
					return;
				}
				throw new Error(\`Failed to connect to stream: \${response.status}\`);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("No response body");
			}

			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\\n\\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						let event: ProgressEvent;
						try {
							event = JSON.parse(line.slice(6)) as ProgressEvent;
						} catch {
							continue;
						}

						if (event.type === "progress") {
							setState({
								status: "generating",
								runId,
								step: event.step,
								totalSteps: event.totalSteps,
								message: event.message,
							});
						} else if (event.type === "completed" && event.data?.result) {
							setState({ status: "completed", result: event.data.result });
						} else if (event.type === "error") {
							setState({
								status: "error",
								error: event.data?.error || "An error occurred",
							});
						}
					}
				}
			}
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				return;
			}
			setState({
				status: "error",
				error: error instanceof Error ? error.message : "Connection lost",
			});
		}
	}, []);

	// Start tracking a workflow with a given runId
	const startWithRunId = useCallback(
		async (runId: string) => {
			setState({
				status: "generating",
				runId,
				step: 0,
				totalSteps: WORKFLOW_TOTAL_STEPS,
				message: "Starting workflow...",
			});

			// Small delay to allow workflow to initialize on Vercel infrastructure
			await new Promise((resolve) => setTimeout(resolve, 500));

			connectToStream(runId);
		},
		[connectToStream],
	);

	// Set error state
	const setError = useCallback((error: string) => {
		setState({ status: "error", error });
	}, []);

	// Reset state to idle
	const reset = useCallback(() => {
		abortControllerRef.current?.abort();
		setState({ status: "idle" });
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			isMountedRef.current = false;

			if (cleanupTimeoutRef.current) {
				clearTimeout(cleanupTimeoutRef.current);
			}

			const currentController = abortControllerRef.current;
			cleanupTimeoutRef.current = setTimeout(() => {
				if (!isMountedRef.current && currentController) {
					currentController.abort();
				}
			}, 200);
		};
	}, []);

	return {
		state,
		startWithRunId,
		setError,
		reset,
	};
}
`;
}
