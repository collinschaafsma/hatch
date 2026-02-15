export function generateConvexTestDbUtils(): string {
	return `// Convex test utilities
// For Convex, integration tests should use a preview deployment
// This module provides mock helpers for unit tests

import { vi } from "vitest";

/**
 * Mock Convex client for unit tests.
 * For integration tests, use a Convex preview deployment.
 */
export function createMockConvexClient() {
	return {
		query: vi.fn(),
		mutation: vi.fn(),
		action: vi.fn(),
	};
}

/**
 * Returns a mock Convex client for testing.
 */
export async function getTestDb() {
	return createMockConvexClient();
}

export async function resetTestDb() {
	// No-op: Convex preview deployments handle isolation
}

export async function seedTestDb() {
	// No-op: Use 'npx convex run seed:seedData --preview-name <name>'
}

export async function closeTestDb() {
	// No-op: No connection to close
}
`;
}
