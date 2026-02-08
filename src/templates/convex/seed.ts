export function generateConvexSeed(): string {
	return `import { mutation } from "./_generated/server";

/**
 * Seed the database with test data.
 * Run with: npx convex run seed:seedData
 * For preview deployments: npx convex run seed:seedData --preview-name <name>
 *
 * Auth tables (users, sessions, etc.) are managed by the Better Auth component.
 * Add app-specific seed data here.
 */
export const seedData = mutation({
	args: {},
	handler: async () => {
		console.log("Seed complete. Add your app-specific seed data here.");
		console.log(
			"Auth data (users, sessions) is managed by Better Auth component.",
		);
		return { seeded: true };
	},
});
`;
}
