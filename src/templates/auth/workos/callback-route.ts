export function generateWorkOSCallback(): string {
	return `import { handleAuth } from "@workos-inc/authkit-nextjs";

export const GET = handleAuth();
`;
}
