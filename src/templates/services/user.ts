export function generateUserService(): string {
	return `import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
// Uncomment when adding database queries:
// import { db } from "@/db";
// import { eq } from "drizzle-orm";
// import { users } from "@/db/schema";

/**
 * Get the current session
 *
 * Uses React cache() to deduplicate requests within a single render.
 */
export const getSession = cache(async () => {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	return session;
});

/**
 * Get the current authenticated user's ID
 *
 * Returns null if not authenticated.
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
	const session = await getSession();
	return session?.user?.id ?? null;
});

/**
 * Get the current authenticated user
 *
 * Returns the user object from the session.
 */
export const getCurrentUser = cache(async () => {
	const session = await getSession();
	if (!session?.user) return null;

	return {
		id: session.user.id,
		email: session.user.email,
		name: session.user.name,
		image: session.user.image,
	};
});

/**
 * Example: Get a user by ID from the database
 * Uncomment and modify once you have a users table in your schema
 */
// export async function getUserById(id: string) {
//   const result = await db
//     .select()
//     .from(users)
//     .where(eq(users.id, id))
//     .limit(1);
//   return result[0] || null;
// }
`;
}
