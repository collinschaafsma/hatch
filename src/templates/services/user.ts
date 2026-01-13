export function generateUserService(useWorkOS: boolean): string {
	if (useWorkOS) {
		return `import { cache } from "react";
import { withAuth } from "@workos-inc/authkit-nextjs";
// Uncomment when adding database queries:
// import { db } from "@/db";
// import { eq } from "drizzle-orm";
// import { users } from "@/db/schema";

/**
 * Get the current authenticated user's database ID
 *
 * Uses React cache() to deduplicate requests within a single render.
 * Multiple calls in a single request will only hit the database once.
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
	const { user } = await withAuth();
	if (!user) return null;

	// If you have a users table that syncs with WorkOS, look up by WorkOS ID:
	// const result = await db
	//   .select({ id: users.id })
	//   .from(users)
	//   .where(eq(users.workosId, user.id))
	//   .limit(1);
	// return result[0]?.id ?? null;

	// For now, return the WorkOS user ID directly
	return user.id;
});

/**
 * Get the current authenticated user context
 *
 * Returns user info from WorkOS auth.
 * Extend this to include database user info if needed.
 */
export const getCurrentUser = cache(async () => {
	const { user } = await withAuth();
	if (!user) return null;

	return {
		id: user.id,
		email: user.email,
		firstName: user.firstName,
		lastName: user.lastName,
		profilePictureUrl: user.profilePictureUrl,
	};
});
`;
	}

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
