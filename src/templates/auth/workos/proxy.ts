export function generateWorkOSProxy(): string {
	return `import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware();

export const config = {
	matcher: [
		"/dashboard/:path*",
		// Exclude workflow endpoints from auth
		"/((?!.well-known/workflow|api/workflow|callback).*)",
	],
};
`;
}
