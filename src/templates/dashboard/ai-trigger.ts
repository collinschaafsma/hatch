export function generateAITriggerButton(): string {
	return `"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AITriggerButton() {
	const [loading, setLoading] = useState(false);
	const [prompt, setPrompt] = useState("What are 3 interesting facts about TypeScript?");
	const [result, setResult] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleTrigger = async () => {
		setLoading(true);
		setError(null);
		setResult(null);

		try {
			const response = await fetch("/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to trigger workflow");
			}

			setResult(\`Workflow started! Run ID: \${data.runId}\`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="prompt">Prompt</Label>
				<Input
					id="prompt"
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					placeholder="Enter a prompt for the AI agent..."
				/>
			</div>

			<Button onClick={handleTrigger} disabled={loading || !prompt}>
				{loading ? "Running..." : "Trigger AI Workflow"}
			</Button>

			{result && (
				<div className="p-4 bg-green-50 text-green-800 rounded border border-green-200">
					{result}
				</div>
			)}

			{error && (
				<div className="p-4 bg-red-50 text-red-800 rounded border border-red-200">
					{error}
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
