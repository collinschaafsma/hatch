export { generateUserFactory } from "./user.js";

export function generateFactoriesIndex(): string {
	return `export * from "./user";
`;
}
