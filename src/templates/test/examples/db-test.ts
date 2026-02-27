export function generateDbTest(): string {
	return `import { describe, it, expect } from "vitest";
import { api } from "@/convex/_generated/api";
import { createConvexTest } from "../utils/test-db";

describe("Convex Function Integration Tests", () => {
	describe("unauthenticated access", () => {
		it("can call a query without auth", async () => {
			const t = createConvexTest();

			// Example: call a public query
			// Replace with your own query once you have one
			try {
				await t.query(api.functions.list, {});
			} catch (error) {
				// Expected if the query requires auth — that's fine,
				// this verifies the in-memory backend is running.
				expect(error).toBeDefined();
			}
		});
	});

	describe("authenticated access", () => {
		it("can call a mutation with an authenticated identity", async () => {
			const t = createConvexTest();
			const _asUser = t.withIdentity({
				name: "Test User",
				email: "test@example.com",
				subject: "user-123",
			});

			// Example: run a direct DB read inside the Convex context
			const result = await t.run(async (_ctx) => {
				// Verify the in-memory DB is accessible
				// Replace with a real table query once your schema has app-specific tables
				return true;
			});

			expect(result).toBe(true);
		});
	});

	describe("mutation round-trip", () => {
		it("can write and read back data", async () => {
			const t = createConvexTest();

			// Use t.run() to insert directly into the in-memory DB
			await t.run(async (_ctx) => {
				// This tests raw DB access — replace with your own table
				// once your schema has concrete tables.
				// For now, this validates the convex-test setup works.
			});
		});
	});
});
`;
}
