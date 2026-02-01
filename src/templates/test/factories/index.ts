export { generateUserFactory } from "./user.js";
export { generateOrganizationFactory } from "./organization.js";

export function generateFactoriesIndex(useWorkOS = false): string {
	if (useWorkOS) {
		return `export * from "./user";
export * from "./organization";
`;
	}
	return `export * from "./user";
`;
}
