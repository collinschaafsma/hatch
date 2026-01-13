export function generateChatQualityEval(): string {
	return `import { openai } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
import { evalite } from "evalite";
import { wrapAISDKModel } from "evalite/ai-sdk";
import { Levenshtein } from "autoevals";

// Wrap the model for automatic tracing and caching
// Type assertion needed for AI SDK v6 compatibility with evalite
const model = wrapAISDKModel(openai("gpt-4o-mini") as unknown as Parameters<typeof wrapAISDKModel>[0]) as LanguageModel;

/**
 * Chat Quality Evaluation
 *
 * Tests basic chat response quality using similarity scoring.
 * Run with: pnpm eval or pnpm eval:watch
 */
evalite("Chat Quality", {
	data: async () => [
		{
			input: "What is TypeScript?",
			expected:
				"TypeScript is a strongly typed programming language that builds on JavaScript.",
		},
		{
			input: "What is React?",
			expected: "React is a JavaScript library for building user interfaces.",
		},
		{
			input: "What is Next.js?",
			expected:
				"Next.js is a React framework for building full-stack web applications.",
		},
	],
	task: async (input) => {
		const result = await generateText({
			model,
			system: "You are a helpful assistant. Answer concisely in one sentence.",
			prompt: input,
		});
		return result.text;
	},
	scorers: [Levenshtein],
});
`;
}
