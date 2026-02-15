export function generateUserFactory(): string {
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
