export function generateBetterAuthClient(): string {
	return `import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

// Get the app URL for auth API requests
// In the browser, always use the current origin to avoid CORS mismatches
// (Vercel previews have multiple URLs but auth is always same-origin)
function getBaseURL(): string {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}
	// SSR fallbacks (auth API calls only happen client-side, but the module initializes during SSR)
	if (process.env.NEXT_PUBLIC_APP_URL) {
		return process.env.NEXT_PUBLIC_APP_URL;
	}
	if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
		return \`https://\${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}\`;
	}
	if (process.env.NEXT_PUBLIC_VERCEL_URL) {
		return \`https://\${process.env.NEXT_PUBLIC_VERCEL_URL}\`;
	}
	return "http://localhost:3000";
}

export const authClient = createAuthClient({
	baseURL: getBaseURL(),
	plugins: [emailOTPClient()],
});

export const { signIn, signOut, useSession } = authClient;
`;
}
