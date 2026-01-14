export function generateAITriggerButton(): string {
	return `"use client";

import { useState, useCallback, startTransition } from "react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useWorkflowProgress } from "@/hooks/use-workflow-progress";
import { useLatest } from "@/hooks/use-latest";

export function AITriggerButton() {
	const [prompt, setPrompt] = useState("What are 3 interesting facts about TypeScript?");
	const { state, startWithRunId, setError, reset } = useWorkflowProgress();
	const promptRef = useLatest(prompt);

	const handleTrigger = useCallback(async () => {
		reset();

		try {
			const response = await fetch("/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt: promptRef.current }),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || "Failed to start workflow");
				return;
			}

			startWithRunId(data.runId);
		} catch (error) {
			setError(error instanceof Error ? error.message : "Failed to start workflow");
		}
	}, [promptRef, reset, setError, startWithRunId]);

	const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		startTransition(() => {
			setPrompt(e.target.value);
		});
	}, []);

	const isRunning = state.status === "generating";

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="prompt">Prompt</Label>
				<Input
					id="prompt"
					value={prompt}
					onChange={handlePromptChange}
					placeholder="Enter a prompt for the AI agent..."
					disabled={isRunning}
				/>
			</div>

			<Button onClick={handleTrigger} disabled={isRunning || !prompt}>
				{isRunning ? "Running..." : "Trigger AI Workflow"}
			</Button>

			{/* Progress indicator */}
			{state.status === "generating" && (
				<div className="p-4 bg-blue-50 text-blue-800 rounded border border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800">
					<div className="flex items-center justify-between mb-2">
						<span className="font-medium">Processing</span>
						<span className="text-sm">
							Step {state.step} of {state.totalSteps}
						</span>
					</div>
					<div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-2">
						<div
							className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
							style={{ width: \`\${(state.step / state.totalSteps) * 100}%\` }}
						/>
					</div>
					<p className="text-sm">{state.message}</p>
				</div>
			)}

			{/* Success state */}
			{state.status === "completed" && (
				<div className="p-4 bg-green-50 text-green-800 rounded border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800">
					<div className="font-medium mb-2">Workflow completed!</div>
					<div className="text-sm whitespace-pre-wrap">{state.result}</div>
				</div>
			)}

			{/* Error state */}
			{state.status === "error" && (
				<div className="p-4 bg-red-50 text-red-800 rounded border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
					<div className="font-medium mb-1">Error</div>
					<div className="text-sm">{state.error}</div>
					<Button
						variant="outline"
						size="sm"
						className="mt-2"
						onClick={reset}
					>
						Try again
					</Button>
				</div>
			)}

			<p className="text-sm text-muted-foreground">
				View workflow runs with: <code className="bg-muted px-1 rounded">npx workflow web</code>
			</p>
		</div>
	);
}
`;
}
