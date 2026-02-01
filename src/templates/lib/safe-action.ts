export function generateSafeAction(useWorkOS: boolean): string {
	if (useWorkOS) {
		return `"use server";

import { createSafeActionClient } from "next-safe-action";
import { withAuth } from "@workos-inc/authkit-nextjs";

/**
 * Base action client without authentication
 * Use this for public actions that don't require auth
 */
export const actionClient = createSafeActionClient();

/**
 * Authenticated action client
 * Automatically validates the user is logged in and provides userId in context
 *
 * Usage:
 * \`\`\`ts
 * export const myAction = authActionClient
 *   .inputSchema(z.object({ ... }))
 *   .action(async ({ parsedInput, ctx }) => {
 *     // ctx.userId is available here
 *     return { success: true };
 *   });
 * \`\`\`
 */
export const authActionClient = actionClient.use(async ({ next }) => {
	const { user } = await withAuth();

	if (!user) {
		throw new Error("Unauthorized: Authentication required");
	}

	return next({
		ctx: {
			userId: user.id,
			user: {
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
			},
		},
	});
});
`;
	}

	return `"use server";

import { createSafeActionClient } from "next-safe-action";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Base action client without authentication
 * Use this for public actions that don't require auth
 */
export const actionClient = createSafeActionClient();

/**
 * Authenticated action client
 * Automatically validates the user is logged in and provides userId in context
 *
 * Usage:
 * \`\`\`ts
 * export const myAction = authActionClient
 *   .inputSchema(z.object({ ... }))
 *   .action(async ({ parsedInput, ctx }) => {
 *     // ctx.userId is available here
 *     return { success: true };
 *   });
 * \`\`\`
 */
export const authActionClient = actionClient.use(async ({ next }) => {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		throw new Error("Unauthorized: Authentication required");
	}

	return next({
		ctx: {
			userId: session.user.id,
			user: {
				id: session.user.id,
				email: session.user.email,
				name: session.user.name,
			},
		},
	});
});
`;
}
