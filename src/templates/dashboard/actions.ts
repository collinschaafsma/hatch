export function generateDashboardActions(): string {
	return `"use server";

import { z } from "zod";
import { authActionClient } from "@/lib/safe-action";

/**
 * Example authenticated server action
 *
 * This demonstrates using next-safe-action with:
 * - Zod schema validation
 * - Authentication middleware (ctx.userId available)
 * - Type-safe input/output
 */
export const exampleAction = authActionClient
	.schema(
		z.object({
			message: z.string().min(1, "Message is required"),
		}),
	)
	.action(async ({ parsedInput, ctx }) => {
		// ctx.userId and ctx.user are available from the auth middleware
		console.log(\`User \${ctx.userId} sent: \${parsedInput.message}\`);

		return {
			success: true,
			userId: ctx.userId,
			echo: parsedInput.message,
		};
	});

/**
 * Example action with more complex input
 */
export const updateSettingsAction = authActionClient
	.schema(
		z.object({
			notifications: z.boolean().optional(),
			theme: z.enum(["light", "dark", "system"]).optional(),
		}),
	)
	.action(async ({ parsedInput }) => {
		// In a real app, you'd update the database here using ctx.userId
		// await db.update(userSettings).set(parsedInput).where(eq(userSettings.userId, ctx.userId));

		return {
			success: true,
			updatedSettings: parsedInput,
		};
	});
`;
}
