export function generateExampleWorkflow(): string {
	return `"use workflow";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { sleep } from "workflow";

export async function aiAgentWorkflow(prompt: string) {
	"use workflow";

	// Step 1: Process the prompt
	const processedPrompt = await processPrompt(prompt);

	// Step 2: Call AI agent
	const response = await callAIAgent(processedPrompt);

	// Step 3: Simulate post-processing delay
	await sleep("2s");

	return response;
}

async function processPrompt(prompt: string): Promise<string> {
	"use step";
	// Add any preprocessing logic here
	return \`User request: \${prompt}\`;
}

async function callAIAgent(prompt: string): Promise<string> {
	"use step";

	const result = await generateText({
		model: openai("gpt-4o"),
		prompt,
		system: "You are a helpful AI assistant. Be concise and helpful.",
	});

	return result.text;
}
`;
}
