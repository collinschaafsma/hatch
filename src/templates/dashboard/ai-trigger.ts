export function generateAITriggerButton(): string {
	return `"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function AITriggerButton() {
	const [prompt, setPrompt] = useState("What are 3 interesting facts about TypeScript?");
	const [runId, setRunId] = useState<Id<"workflowRuns"> | null>(null);
	const startWorkflow = useMutation(api.workflows.startRun);
	const run = useQuery(api.workflows.getRun, runId ? { runId } : "skip");
	const isRunning = run?.status === "running";

	const handleTrigger = useCallback(async () => {
		setRunId(null);
		const id = await startWorkflow({ prompt });
		setRunId(id);
	}, [prompt, startWorkflow]);

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="prompt">Prompt</Label>
				<Input
					id="prompt"
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					placeholder="Enter a prompt for the AI agent..."
					disabled={isRunning}
				/>
			</div>

			<Button onClick={handleTrigger} disabled={isRunning || !prompt}>
				{isRunning ? "Running..." : "Trigger AI Workflow"}
			</Button>

			{/* Progress indicator */}
			{run?.status === "running" && (
				<div className="p-4 bg-blue-50 text-blue-800 rounded border border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800">
					<div className="flex items-center justify-between mb-2">
						<span className="text-sm font-medium">Processing</span>
						<span className="text-sm">
							Step {run.step} of {run.totalSteps}
						</span>
					</div>
					<div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-2">
						<div
							className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
							style={{ width: \`\${(run.step / run.totalSteps) * 100}%\` }}
						/>
					</div>
					<p className="text-sm">{run.message}</p>
				</div>
			)}

			{/* Success state */}
			{run?.status === "completed" && (
				<div className="p-4 bg-green-50 text-green-800 rounded border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800">
					<div className="font-medium mb-2">Workflow completed!</div>
					<div className="text-sm whitespace-pre-wrap">{run.result}</div>
					<Button
						variant="outline"
						size="sm"
						className="mt-2"
						onClick={() => setRunId(null)}
					>
						Reset
					</Button>
				</div>
			)}

			{/* Error state */}
			{run?.status === "error" && (
				<div className="p-4 bg-red-50 text-red-800 rounded border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
					<div className="font-medium mb-1">Error</div>
					<div className="text-sm">{run.error}</div>
					<Button
						variant="outline"
						size="sm"
						className="mt-2"
						onClick={() => setRunId(null)}
					>
						Try again
					</Button>
				</div>
			)}
		</div>
	);
}
`;
}
