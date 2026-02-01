export function generateWorkOSDbTest(_projectName: string): string {
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

describe("WorkOS Schema Integration Tests", () => {
	beforeAll(async () => {
		await getTestDb();
	});

	beforeEach(async () => {
		await resetTestDb();
	});

	afterAll(async () => {
		await closeTestDb();
	});

	describe("users table", () => {
		it("can create a user with WorkOS fields", async () => {
			const db = await getTestDb();

			const [user] = await db
				.insert(schema.users)
				.values({
					workosId: "user_test123",
					email: "test@example.com",
					firstName: "Test",
					lastName: "User",
					emailVerified: true,
				})
				.returning();

			expect(user.id).toBeDefined();
			expect(user.workosId).toBe("user_test123");
			expect(user.email).toBe("test@example.com");
			expect(user.firstName).toBe("Test");
			expect(user.lastName).toBe("User");
			expect(user.emailVerified).toBe(true);
			expect(user.createdAt).toBeInstanceOf(Date);
		});

		it("enforces unique workosId constraint", async () => {
			const db = await getTestDb();

			await db.insert(schema.users).values({
				workosId: "user_duplicate",
				email: "user1@example.com",
			});

			await expect(
				db.insert(schema.users).values({
					workosId: "user_duplicate",
					email: "user2@example.com",
				}),
			).rejects.toThrow();
		});

		it("enforces unique email constraint", async () => {
			const db = await getTestDb();

			await db.insert(schema.users).values({
				workosId: "user_1",
				email: "duplicate@example.com",
			});

			await expect(
				db.insert(schema.users).values({
					workosId: "user_2",
					email: "duplicate@example.com",
				}),
			).rejects.toThrow();
		});

		it("can update user fields", async () => {
			const db = await getTestDb();

			const [user] = await db
				.insert(schema.users)
				.values({
					workosId: "user_update",
					email: "update@example.com",
				})
				.returning();

			const [updated] = await db
				.update(schema.users)
				.set({ firstName: "Updated", lastName: "Name" })
				.where(eq(schema.users.id, user.id))
				.returning();

			expect(updated.firstName).toBe("Updated");
			expect(updated.lastName).toBe("Name");
		});
	});

	describe("organizations table", () => {
		it("can create an organization", async () => {
			const db = await getTestDb();

			const [org] = await db
				.insert(schema.organizations)
				.values({
					workosId: "org_test123",
					name: "Test Organization",
				})
				.returning();

			expect(org.id).toBeDefined();
			expect(org.workosId).toBe("org_test123");
			expect(org.name).toBe("Test Organization");
			expect(org.allowProfilesOutsideOrganization).toBe(false);
		});

		it("enforces unique workosId constraint", async () => {
			const db = await getTestDb();

			await db.insert(schema.organizations).values({
				workosId: "org_duplicate",
				name: "Org 1",
			});

			await expect(
				db.insert(schema.organizations).values({
					workosId: "org_duplicate",
					name: "Org 2",
				}),
			).rejects.toThrow();
		});

		it("can update organization fields", async () => {
			const db = await getTestDb();

			const [org] = await db
				.insert(schema.organizations)
				.values({
					workosId: "org_update",
					name: "Original Name",
				})
				.returning();

			const [updated] = await db
				.update(schema.organizations)
				.set({ name: "Updated Name", allowProfilesOutsideOrganization: true })
				.where(eq(schema.organizations.id, org.id))
				.returning();

			expect(updated.name).toBe("Updated Name");
			expect(updated.allowProfilesOutsideOrganization).toBe(true);
		});
	});

	describe("organization memberships", () => {
		it("can create membership linking user and org", async () => {
			const db = await getTestDb();

			const [user] = await db
				.insert(schema.users)
				.values({
					workosId: "user_member1",
					email: "member@example.com",
				})
				.returning();

			const [org] = await db
				.insert(schema.organizations)
				.values({
					workosId: "org_team1",
					name: "Team",
				})
				.returning();

			const [membership] = await db
				.insert(schema.organizationMemberships)
				.values({
					workosId: "om_test123",
					userId: user.id,
					organizationId: org.id,
					roleSlug: "admin",
					roleName: "Admin",
				})
				.returning();

			expect(membership.userId).toBe(user.id);
			expect(membership.organizationId).toBe(org.id);
			expect(membership.roleSlug).toBe("admin");
			expect(membership.roleName).toBe("Admin");
			expect(membership.status).toBe("active");
		});

		it("enforces unique user per organization", async () => {
			const db = await getTestDb();

			const [user] = await db
				.insert(schema.users)
				.values({
					workosId: "user_unique_test",
					email: "unique@example.com",
				})
				.returning();

			const [org] = await db
				.insert(schema.organizations)
				.values({
					workosId: "org_unique_test",
					name: "Unique Org",
				})
				.returning();

			await db.insert(schema.organizationMemberships).values({
				workosId: "om_first",
				userId: user.id,
				organizationId: org.id,
			});

			await expect(
				db.insert(schema.organizationMemberships).values({
					workosId: "om_second",
					userId: user.id,
					organizationId: org.id,
				}),
			).rejects.toThrow();
		});

		it("cascades delete when user is deleted", async () => {
			const db = await getTestDb();

			const [user] = await db
				.insert(schema.users)
				.values({
					workosId: "user_cascade",
					email: "cascade@example.com",
				})
				.returning();

			const [org] = await db
				.insert(schema.organizations)
				.values({
					workosId: "org_cascade",
					name: "Cascade Org",
				})
				.returning();

			await db.insert(schema.organizationMemberships).values({
				workosId: "om_cascade",
				userId: user.id,
				organizationId: org.id,
				roleSlug: "member",
				roleName: "Member",
			});

			await db.delete(schema.users).where(eq(schema.users.id, user.id));

			const memberships = await db
				.select()
				.from(schema.organizationMemberships);
			expect(memberships).toHaveLength(0);
		});

		it("cascades delete when organization is deleted", async () => {
			const db = await getTestDb();

			const [user] = await db
				.insert(schema.users)
				.values({
					workosId: "user_org_cascade",
					email: "orgcascade@example.com",
				})
				.returning();

			const [org] = await db
				.insert(schema.organizations)
				.values({
					workosId: "org_to_delete",
					name: "Delete Me Org",
				})
				.returning();

			await db.insert(schema.organizationMemberships).values({
				workosId: "om_org_cascade",
				userId: user.id,
				organizationId: org.id,
			});

			await db
				.delete(schema.organizations)
				.where(eq(schema.organizations.id, org.id));

			const memberships = await db
				.select()
				.from(schema.organizationMemberships);
			expect(memberships).toHaveLength(0);

			// User should still exist
			const users = await db.select().from(schema.users);
			expect(users).toHaveLength(1);
		});
	});

	describe("seed data", () => {
		it("seeds test data correctly", async () => {
			await seedTestDb();

			const db = await getTestDb();
			const users = await db.select().from(schema.users);
			const orgs = await db.select().from(schema.organizations);
			const memberships = await db
				.select()
				.from(schema.organizationMemberships);

			expect(users).toHaveLength(1);
			expect(users[0].workosId).toBe("user_test1");
			expect(orgs).toHaveLength(1);
			expect(orgs[0].workosId).toBe("org_test1");
			expect(memberships).toHaveLength(1);
			expect(memberships[0].roleSlug).toBe("admin");
		});
	});
});
`;
}
