export function generateWorkOSSchema(): string {
	return `import {
	pgTable,
	text,
	timestamp,
	uuid,
	boolean,
	index,
	unique,
} from "drizzle-orm/pg-core";

// Users table - synced from WorkOS
export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workosId: text("workos_id").notNull().unique(),
		email: text("email").notNull().unique(),
		firstName: text("first_name"),
		lastName: text("last_name"),
		profilePictureUrl: text("profile_picture_url"),
		emailVerified: boolean("email_verified").default(false).notNull(),
		lastSignInAt: timestamp("last_sign_in_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		index("users_workos_id_idx").on(table.workosId),
		index("users_email_idx").on(table.email),
	],
);

// Organizations table - synced from WorkOS
export const organizations = pgTable(
	"organizations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workosId: text("workos_id").notNull().unique(),
		name: text("name").notNull(),
		allowProfilesOutsideOrganization: boolean(
			"allow_profiles_outside_organization",
		)
			.default(false)
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [index("organizations_workos_id_idx").on(table.workosId)],
);

// Organization memberships - junction table linking users to organizations
export const organizationMemberships = pgTable(
	"organization_memberships",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workosId: text("workos_id").notNull().unique(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		roleSlug: text("role_slug"),
		roleName: text("role_name"),
		status: text("status").default("active"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		index("org_memberships_org_id_idx").on(table.organizationId),
		index("org_memberships_user_id_idx").on(table.userId),
		unique("org_memberships_org_user_unique").on(
			table.organizationId,
			table.userId,
		),
	],
);

`;
}
