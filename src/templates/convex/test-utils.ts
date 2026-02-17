export function generateConvexTestDbUtils(): string {
	return `// Convex test utilities using convex-test
// Provides an in-memory Convex backend for Vitest — no mocks needed.

import schema from "@/convex/schema";
import { convexTest } from "convex-test";

// Import all Convex modules so convex-test can resolve function references
const modules = import.meta.glob("../../convex/**/*.ts");

/**
 * Creates a convex-test instance with schema and modules pre-configured.
 * Use t.run() / t.query() / t.mutation() / t.action() to test Convex functions.
 *
 * @example
 * const t = createConvexTest();
 * await t.mutation(api.myModule.myMutation, { arg: "value" });
 * const result = await t.query(api.myModule.myQuery, {});
 * expect(result).toEqual(...);
 */
export function createConvexTest() {
	return convexTest(schema, modules);
}
`;
}
