export function generateStructuredOutputEval(): string {
	return `import { openai } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";
import { evalite } from "evalite";
import { wrapAISDKModel } from "evalite/ai-sdk";
import { z } from "zod";

// Wrap the model for automatic tracing and caching
// Type assertion needed for AI SDK v6 compatibility with evalite
const model = wrapAISDKModel(openai("gpt-4o-mini") as unknown as Parameters<typeof wrapAISDKModel>[0]) as LanguageModel;

// Define the schema for structured output
const TaskSchema = z.object({
	title: z.string().describe("A short title for the task"),
	priority: z.enum(["low", "medium", "high"]).describe("Task priority level"),
	tags: z.array(z.string()).describe("Relevant tags for the task"),
});

type Task = z.infer<typeof TaskSchema>;

/**
 * Structured Output Evaluation
 *
 * Tests the model's ability to extract structured data from natural language.
 * Validates schema conformance and field accuracy.
 * Run with: pnpm eval or pnpm eval:watch
 */
evalite<string, Task, Task>("Structured Output - Task Extraction", {
	data: async () => [
		{
			input: "I need to finish the quarterly report by Friday, it's really important",
			expected: {
				title: "Finish quarterly report",
				priority: "high",
				tags: ["report", "quarterly"],
			},
		},
		{
			input: "Maybe update the docs sometime next week, not urgent",
			expected: {
				title: "Update documentation",
				priority: "low",
				tags: ["documentation"],
			},
		},
		{
			input: "Fix the login bug today, users are complaining",
			expected: {
				title: "Fix login bug",
				priority: "high",
				tags: ["bug", "login"],
			},
		},
	],
	task: async (input) => {
		const result = await generateObject({
			model,
			schema: TaskSchema,
			system: "Extract task information from the user's message.",
			prompt: input,
		});
		return result.object;
	},
	scorers: [
		{
			name: "Schema Valid",
			scorer: ({ output }) => {
				const result = TaskSchema.safeParse(output);
				return result.success ? 1 : 0;
			},
		},
		{
			name: "Priority Match",
			scorer: ({ output, expected }) => {
				return output.priority === expected.priority ? 1 : 0;
			},
		},
		{
			name: "Has Tags",
			scorer: ({ output }) => {
				return output.tags && output.tags.length > 0 ? 1 : 0;
			},
		},
	],
});
`;
}
