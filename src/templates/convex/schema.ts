export function generateConvexSchema(): string {
	return `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Auth tables (users, sessions, accounts, verifications) are managed
// by the Better Auth component in convex/betterAuth/.
// Add your app-specific tables here.
export default defineSchema({
	workflowRuns: defineTable({
		status: v.union(
			v.literal("running"),
			v.literal("completed"),
			v.literal("error"),
		),
		step: v.number(),
		totalSteps: v.number(),
		message: v.string(),
		result: v.optional(v.string()),
		error: v.optional(v.string()),
		createdAt: v.number(),
	}),
});
`;
}
