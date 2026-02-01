export function generateOrganizationFactory(): string {
	return `import { faker } from "@faker-js/faker";

interface Organization {
	id: string;
	workosId: string;
	name: string;
	allowProfilesOutsideOrganization: boolean;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
}

/**
 * Create a fake organization for testing
 * @param overrides - Optional fields to override the generated values
 */
export function createOrganization(
	overrides?: Partial<Organization>,
): Organization {
	return {
		id: faker.string.uuid(),
		workosId: \`org_\${faker.string.alphanumeric(24)}\`,
		name: faker.company.name(),
		allowProfilesOutsideOrganization: false,
		createdAt: faker.date.past(),
		updatedAt: faker.date.recent(),
		deletedAt: null,
		...overrides,
	};
}

/**
 * Create organization input data (for insert operations)
 */
export function createOrganizationInput(overrides?: {
	workosId?: string;
	name?: string;
	allowProfilesOutsideOrganization?: boolean;
}) {
	return {
		workosId: \`org_\${faker.string.alphanumeric(24)}\`,
		name: faker.company.name(),
		allowProfilesOutsideOrganization: false,
		...overrides,
	};
}

interface OrganizationMembership {
	id: string;
	workosId: string;
	organizationId: string;
	userId: string;
	roleSlug: string | null;
	roleName: string | null;
	status: string | null;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
}

/**
 * Create a fake organization membership for testing
 * @param overrides - Optional fields to override the generated values
 */
export function createOrganizationMembership(
	overrides?: Partial<OrganizationMembership>,
): OrganizationMembership {
	return {
		id: faker.string.uuid(),
		workosId: \`om_\${faker.string.alphanumeric(24)}\`,
		organizationId: faker.string.uuid(),
		userId: faker.string.uuid(),
		roleSlug: "member",
		roleName: "Member",
		status: "active",
		createdAt: faker.date.past(),
		updatedAt: faker.date.recent(),
		deletedAt: null,
		...overrides,
	};
}

/**
 * Create organization membership input data (for insert operations)
 */
export function createOrganizationMembershipInput(overrides?: {
	workosId?: string;
	organizationId?: string;
	userId?: string;
	roleSlug?: string;
	roleName?: string;
	status?: string;
}) {
	return {
		workosId: \`om_\${faker.string.alphanumeric(24)}\`,
		organizationId: overrides?.organizationId ?? faker.string.uuid(),
		userId: overrides?.userId ?? faker.string.uuid(),
		roleSlug: "member",
		roleName: "Member",
		status: "active",
		...overrides,
	};
}
`;
}
