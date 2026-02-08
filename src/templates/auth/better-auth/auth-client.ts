export function generateBetterAuthClient(): string {
	return `import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

// Get the app URL, checking multiple sources for different environments
function getBaseURL(): string {
	// Explicit app URL (set in .env.local for feature VMs)
	if (process.env.NEXT_PUBLIC_APP_URL) {
		return process.env.NEXT_PUBLIC_APP_URL;
	}
	// Vercel deployment URL (preview-specific, checked first so previews don't use production URL)
	if (process.env.NEXT_PUBLIC_VERCEL_URL) {
		return \`https://\${process.env.NEXT_PUBLIC_VERCEL_URL}\`;
	}
	// Vercel production domain (automatic system env var)
	if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
		return \`https://\${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}\`;
	}
	// Local development
	return "http://localhost:3000";
}

export const authClient = createAuthClient({
	baseURL: getBaseURL(),
	plugins: [emailOTPClient()],
});

export const { signIn, signOut, useSession } = authClient;
`;
}
