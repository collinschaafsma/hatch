export function generateBetterAuthClient(): string {
	return `import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

// Get the app URL, checking multiple sources for different environments
function getBaseURL(): string {
	// Explicit app URL (set in .env.local for feature VMs)
	if (process.env.NEXT_PUBLIC_APP_URL) {
		return process.env.NEXT_PUBLIC_APP_URL;
	}
	// Vercel: use production URL on production, deployment URL on preview
	if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
		return \`https://\${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}\`;
	}
	if (process.env.NEXT_PUBLIC_VERCEL_URL) {
		return \`https://\${process.env.NEXT_PUBLIC_VERCEL_URL}\`;
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
