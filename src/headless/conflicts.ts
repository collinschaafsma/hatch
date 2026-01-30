import crypto from "node:crypto";

/**
 * Generate a unique suffix for conflict resolution (6 hex characters)
 */
export function generateUniqueSuffix(): string {
	return crypto.randomBytes(3).toString("hex");
}

/**
 * Append a unique suffix to a name for conflict resolution
 */
export function appendUniqueSuffix(name: string): string {
	const suffix = generateUniqueSuffix();
	return `${name}-${suffix}`;
}

/**
 * Resolve a name conflict by either failing or appending a suffix
 */
export function resolveNameConflict(
	name: string,
	strategy: "suffix" | "fail",
): string {
	if (strategy === "fail") {
		throw new Error(
			`Name "${name}" already exists. Use --conflict-strategy=suffix to auto-rename.`,
		);
	}
	return appendUniqueSuffix(name);
}

/**
 * Generate a secure random password for database
 */
export function generateDbPassword(): string {
	// Generate a 24-character alphanumeric password
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const bytes = crypto.randomBytes(24);
	let password = "";
	for (const byte of bytes) {
		password += chars[byte % chars.length];
	}
	return password;
}
