export function generateAITriggerButton(): string {
	return `"use client";

import { useState, startTransition } from "react";
import useSWRMutation from "swr/mutation";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

// Fetcher function for SWR mutation
async function triggerWorkflow(
	url: string,
	{ arg }: { arg: { prompt: string } }
): Promise<{ runId: string }> {
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(arg),
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.error || "Failed to trigger workflow");
	}

	return data;
}

export function AITriggerButton() {
	const [prompt, setPrompt] = useState("What are 3 interesting facts about TypeScript?");

	const { trigger, isMutating, data, error, reset } = useSWRMutation(
		"/api/workflow",
		triggerWorkflow
	);

	const handleTrigger = () => {
		reset(); // Clear previous results
		trigger({ prompt });
	};

	const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		// Use transition for non-urgent input updates
		startTransition(() => {
			setPrompt(e.target.value);
		});
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="prompt">Prompt</Label>
				<Input
					id="prompt"
					value={prompt}
					onChange={handlePromptChange}
					placeholder="Enter a prompt for the AI agent..."
				/>
			</div>

			<Button onClick={handleTrigger} disabled={isMutating || !prompt}>
				{isMutating ? "Running..." : "Trigger AI Workflow"}
			</Button>

			{data ? (
				<div className="p-4 bg-green-50 text-green-800 rounded border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800">
					Workflow started! Run ID: {data.runId}
				</div>
			) : null}

			{error ? (
				<div className="p-4 bg-red-50 text-red-800 rounded border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
					{error instanceof Error ? error.message : "An error occurred"}
				</div>
			) : null}

			<p className="text-sm text-muted-foreground">
				View workflow runs with: <code className="bg-muted px-1 rounded">npx workflow web</code>
			</p>
		</div>
	);
}
`;
}
