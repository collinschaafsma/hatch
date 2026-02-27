export function generateConvexSchema(): string {
	return `import { defineSchema } from "convex/server";

// Auth tables (users, sessions, accounts, verifications) are managed
// by the Better Auth component in convex/betterAuth/.
// Add your app-specific tables here.
export default defineSchema({});
`;
}
