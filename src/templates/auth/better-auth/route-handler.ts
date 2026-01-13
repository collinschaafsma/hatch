export function generateBetterAuthRouteHandler(): string {
	return `import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { POST, GET } = toNextJsHandler(auth);
`;
}
