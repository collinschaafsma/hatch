export function generateUserFactory(useWorkOS = false): string {
	if (useWorkOS) {
		return `import { faker } from "@faker-js/faker";

interface User {
	id: string;
	workosId: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	profilePictureUrl: string | null;
	emailVerified: boolean;
	lastSignInAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
}

/**
 * Create a fake user for testing (WorkOS schema)
 * @param overrides - Optional fields to override the generated values
 */
export function createUser(overrides?: Partial<User>): User {
	return {
		id: faker.string.uuid(),
		workosId: \`user_\${faker.string.alphanumeric(24)}\`,
		email: faker.internet.email(),
		firstName: faker.person.firstName(),
		lastName: faker.person.lastName(),
		profilePictureUrl: faker.image.avatar(),
		emailVerified: true,
		lastSignInAt: faker.date.recent(),
		createdAt: faker.date.past(),
		updatedAt: faker.date.recent(),
		deletedAt: null,
		...overrides,
	};
}

/**
 * Create user input data (for insert operations)
 */
export function createUserInput(overrides?: {
	workosId?: string;
	email?: string;
	firstName?: string | null;
	lastName?: string | null;
	profilePictureUrl?: string | null;
	emailVerified?: boolean;
}) {
	return {
		workosId: \`user_\${faker.string.alphanumeric(24)}\`,
		email: faker.internet.email(),
		firstName: faker.person.firstName(),
		lastName: faker.person.lastName(),
		profilePictureUrl: faker.image.avatar(),
		emailVerified: true,
		...overrides,
	};
}
`;
	}

	return `import { faker } from "@faker-js/faker";

// User type matching Better Auth schema
interface User {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Create a fake user for testing (Better Auth schema)
 * @param overrides - Optional fields to override the generated values
 */
export function createUser(overrides?: Partial<User>): User {
	return {
		id: faker.string.alphanumeric(24),
		name: faker.person.fullName(),
		email: faker.internet.email(),
		emailVerified: true,
		image: faker.image.avatar(),
		createdAt: faker.date.past(),
		updatedAt: faker.date.recent(),
		...overrides,
	};
}

/**
 * Create user input data (for insert operations)
 * Note: createdAt/updatedAt have defaults in the schema
 */
export function createUserInput(overrides?: {
	id?: string;
	name?: string;
	email?: string;
	emailVerified?: boolean;
	image?: string | null;
}) {
	return {
		id: faker.string.alphanumeric(24),
		name: faker.person.fullName(),
		email: faker.internet.email(),
		emailVerified: true,
		image: faker.image.avatar(),
		...overrides,
	};
}
`;
}
