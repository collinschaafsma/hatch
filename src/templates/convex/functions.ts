export function generateConvexFunctions(): string {
	return `import { query } from "./_generated/server";

// Auth data (users, sessions) is managed by the Better Auth component.
// Use the auth client on the frontend or lib/auth.ts on the server
// to access user/session data.

// Example: list all table names (placeholder - replace with your app queries)
export const hello = query({
	args: {},
	handler: async () => {
		return { message: "Hello from Convex!" };
	},
});
`;
}
