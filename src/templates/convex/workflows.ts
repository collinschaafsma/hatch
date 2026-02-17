export function generateConvexWorkflows(): string {
	return `// biome-ignore-all: handlers use \`any\` until \`npx convex dev\` generates real types
import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "./_generated/api";
import {
	internalAction,
	internalMutation,
	mutation,
	query,
} from "./_generated/server";
import { v } from "convex/values";

export const workflow = new WorkflowManager(components.workflow);

export const aiAgentWorkflow = workflow.define({
	args: { prompt: v.string(), runId: v.id("workflowRuns") },
	handler: async (ctx: any, args: any): Promise<string> => {
		await ctx.runMutation(internal.workflows.updateRun, {
			runId: args.runId,
			step: 1,
			message: "Analyzing your prompt...",
		});

		await ctx.runMutation(internal.workflows.updateRun, {
			runId: args.runId,
			step: 2,
			message: "Generating AI response...",
		});
		const result = await ctx.runAction(internal.workflows.generateAIResponse, {
			prompt: args.prompt,
		});

		await ctx.runMutation(internal.workflows.updateRun, {
			runId: args.runId,
			step: 3,
			message: "Processing results...",
		});

		await ctx.runMutation(internal.workflows.completeRun, {
			runId: args.runId,
			result,
		});

		return result;
	},
});

export const generateAIResponse = internalAction({
	args: { prompt: v.string() },
	handler: async (_ctx: any, args: any) => {
		const { generateText } = await import("ai");
		const { openai } = await import("@ai-sdk/openai");
		const result = await generateText({
			model: openai("gpt-4o-mini") as any,
			prompt: \`User request: \${args.prompt}\`,
			system: "You are a helpful AI assistant. Be concise and helpful.",
		});
		return result.text;
	},
});

export const startRun = mutation({
	args: { prompt: v.string() },
	handler: async (ctx: any, args: any) => {
		const runId = await ctx.db.insert("workflowRuns", {
			status: "running",
			step: 0,
			totalSteps: 4,
			message: "Initializing workflow...",
			createdAt: Date.now(),
		});
		await workflow.start(ctx, internal.workflows.aiAgentWorkflow, {
			prompt: args.prompt,
			runId,
		});
		return runId;
	},
});

export const updateRun = internalMutation({
	args: {
		runId: v.id("workflowRuns"),
		step: v.number(),
		message: v.string(),
	},
	handler: async (ctx: any, args: any) => {
		await ctx.db.patch(args.runId, {
			step: args.step,
			message: args.message,
		});
	},
});

export const completeRun = internalMutation({
	args: { runId: v.id("workflowRuns"), result: v.string() },
	handler: async (ctx: any, args: any) => {
		await ctx.db.patch(args.runId, {
			status: "completed",
			step: 4,
			message: "Complete",
			result: args.result,
		});
	},
});

export const getRun = query({
	args: { runId: v.id("workflowRuns") },
	handler: async (ctx: any, args: any) => ctx.db.get(args.runId),
});
`;
}
