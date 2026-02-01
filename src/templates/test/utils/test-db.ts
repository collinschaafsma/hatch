export function generateTestDbUtils(
	projectName: string,
	useWorkOS = false,
): string {
	if (useWorkOS) {
		return `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../db/schema";
import { sql } from "drizzle-orm";

const TEST_DATABASE_URL =
	process.env.TEST_DATABASE_URL ||
	"postgresql://postgres:postgres@localhost:5434/${projectName}_test";

let pool: Pool | null = null;
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getTestDb() {
	if (!testDb) {
		pool = new Pool({ connectionString: TEST_DATABASE_URL });
		testDb = drizzle(pool, { schema });
	}
	return testDb;
}

export async function resetTestDb() {
	const db = await getTestDb();
	// Truncate all tables in correct order (respecting foreign key constraints)
	await db.execute(
		sql\`TRUNCATE TABLE organization_memberships, organizations, users RESTART IDENTITY CASCADE\`,
	);
}

export async function seedTestDb() {
	const db = await getTestDb();

	// Create test users
	const [user1] = await db
		.insert(schema.users)
		.values({
			workosId: "user_test1",
			email: "test1@example.com",
			firstName: "Test",
			lastName: "User",
			emailVerified: true,
		})
		.returning();

	// Create test organization
	const [org1] = await db
		.insert(schema.organizations)
		.values({
			workosId: "org_test1",
			name: "Test Organization",
		})
		.returning();

	// Create membership
	await db.insert(schema.organizationMemberships).values({
		workosId: "om_test1",
		userId: user1.id,
		organizationId: org1.id,
		roleSlug: "admin",
		roleName: "Admin",
	});
}

export async function closeTestDb() {
	if (pool) {
		await pool.end();
		pool = null;
		testDb = null;
	}
}
`;
	}

	return `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../db/schema";
import { sql } from "drizzle-orm";

const TEST_DATABASE_URL =
	process.env.TEST_DATABASE_URL ||
	"postgresql://postgres:postgres@localhost:5434/${projectName}_test";

let pool: Pool | null = null;
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getTestDb() {
	if (!testDb) {
		pool = new Pool({ connectionString: TEST_DATABASE_URL });
		testDb = drizzle(pool, { schema });
	}
	return testDb;
}

export async function resetTestDb() {
	const db = await getTestDb();
	// Truncate all tables in correct order (respecting foreign key constraints)
	await db.execute(
		sql\`TRUNCATE TABLE verification, account, session, "user" RESTART IDENTITY CASCADE\`,
	);
}

export async function seedTestDb() {
	const db = await getTestDb();

	// Create test user
	await db.insert(schema.user).values({
		id: "test-user-1",
		name: "Test User",
		email: "test@example.com",
		emailVerified: true,
	});

	// Create test session
	await db.insert(schema.session).values({
		id: "test-session-1",
		userId: "test-user-1",
		token: "test-token-123",
		expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
	});
}

export async function closeTestDb() {
	if (pool) {
		await pool.end();
		pool = null;
		testDb = null;
	}
}
`;
}
