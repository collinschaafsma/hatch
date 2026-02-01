export function generateDbTest(_projectName: string): string {
	return `import {
	describe,
	it,
	expect,
	beforeAll,
	beforeEach,
	afterAll,
} from "vitest";
import { eq } from "drizzle-orm";
import {
	getTestDb,
	resetTestDb,
	seedTestDb,
	closeTestDb,
} from "../utils/test-db";
import * as schema from "@/db/schema";

describe("Better Auth Schema Integration Tests", () => {
	beforeAll(async () => {
		await getTestDb();
	});

	beforeEach(async () => {
		await resetTestDb();
	});

	afterAll(async () => {
		await closeTestDb();
	});

	describe("user table", () => {
		it("can create a user", async () => {
			const db = await getTestDb();

			const [user] = await db
				.insert(schema.user)
				.values({
					id: "user-123",
					name: "John Doe",
					email: "john@example.com",
				})
				.returning();

			expect(user.id).toBe("user-123");
			expect(user.name).toBe("John Doe");
			expect(user.email).toBe("john@example.com");
			expect(user.emailVerified).toBe(false); // default value
			expect(user.createdAt).toBeInstanceOf(Date);
		});

		it("enforces unique email constraint", async () => {
			const db = await getTestDb();

			await db.insert(schema.user).values({
				id: "user-1",
				name: "User 1",
				email: "duplicate@example.com",
			});

			await expect(
				db.insert(schema.user).values({
					id: "user-2",
					name: "User 2",
					email: "duplicate@example.com",
				}),
			).rejects.toThrow();
		});

		it("can update user fields", async () => {
			const db = await getTestDb();

			await db.insert(schema.user).values({
				id: "user-update",
				name: "Original Name",
				email: "update@example.com",
			});

			const [updated] = await db
				.update(schema.user)
				.set({ name: "Updated Name", emailVerified: true })
				.where(eq(schema.user.id, "user-update"))
				.returning();

			expect(updated.name).toBe("Updated Name");
			expect(updated.emailVerified).toBe(true);
		});
	});

	describe("session table", () => {
		it("can create a session for a user", async () => {
			const db = await getTestDb();

			// Create user first
			await db.insert(schema.user).values({
				id: "user-session",
				name: "Session User",
				email: "session@example.com",
			});

			const [session] = await db
				.insert(schema.session)
				.values({
					id: "session-123",
					userId: "user-session",
					token: "token-abc",
					expiresAt: new Date(Date.now() + 3600000),
				})
				.returning();

			expect(session.id).toBe("session-123");
			expect(session.userId).toBe("user-session");
			expect(session.token).toBe("token-abc");
		});

		it("cascades delete when user is deleted", async () => {
			const db = await getTestDb();

			await db.insert(schema.user).values({
				id: "user-cascade",
				name: "Cascade User",
				email: "cascade@example.com",
			});

			await db.insert(schema.session).values({
				id: "session-cascade",
				userId: "user-cascade",
				token: "token-cascade",
				expiresAt: new Date(Date.now() + 3600000),
			});

			await db.delete(schema.user).where(eq(schema.user.id, "user-cascade"));

			const sessions = await db.select().from(schema.session);
			expect(sessions).toHaveLength(0);
		});
	});

	describe("account table", () => {
		it("can create an account for a user", async () => {
			const db = await getTestDb();

			await db.insert(schema.user).values({
				id: "user-account",
				name: "Account User",
				email: "account@example.com",
			});

			const [account] = await db
				.insert(schema.account)
				.values({
					id: "account-123",
					userId: "user-account",
					accountId: "oauth-id-123",
					providerId: "google",
				})
				.returning();

			expect(account.id).toBe("account-123");
			expect(account.providerId).toBe("google");
			expect(account.userId).toBe("user-account");
		});
	});

	describe("verification table", () => {
		it("can create a verification entry", async () => {
			const db = await getTestDb();

			const [verification] = await db
				.insert(schema.verification)
				.values({
					id: "verification-123",
					identifier: "test@example.com",
					value: "otp-code-123456",
					expiresAt: new Date(Date.now() + 600000), // 10 minutes
				})
				.returning();

			expect(verification.id).toBe("verification-123");
			expect(verification.identifier).toBe("test@example.com");
			expect(verification.value).toBe("otp-code-123456");
		});
	});

	describe("seed data", () => {
		it("seeds test data correctly", async () => {
			await seedTestDb();

			const db = await getTestDb();
			const users = await db.select().from(schema.user);
			const sessions = await db.select().from(schema.session);

			expect(users).toHaveLength(1);
			expect(users[0].email).toBe("test@example.com");
			expect(sessions).toHaveLength(1);
			expect(sessions[0].userId).toBe("test-user-1");
		});
	});
});
`;
}
