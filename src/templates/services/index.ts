export { generateUserService } from "./user.js";

export function generateServicesIndex(): string {
	return `export * from "./user";
`;
}
