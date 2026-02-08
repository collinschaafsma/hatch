/**
 * Convex + Better Auth template generators.
 *
 * The @convex-dev/better-auth package is a Convex component.
 * Auth runs inside Convex (server-side), and the Next.js app proxies
 * requests and reads session tokens via cookies.
 *
 * File layout generated:
 *   convex/convex.config.ts           – app component config
 *   convex/auth.config.ts             – JWT auth config provider
 *   convex/http.ts                    – HTTP router with auth routes
 *   convex/betterAuth/convex.config.ts – component definition
 *   convex/betterAuth/auth.ts         – auth options + createAuth
 *   convex/betterAuth/schema.ts       – component schema (auth tables)
 *   convex/betterAuth/adapter.ts      – CRUD API for the component
 *   lib/auth.ts                       – server-side session helpers
 *   lib/auth-client.ts                – client auth with convexClient plugin
 *   app/api/auth/[...all]/route.ts    – Next.js API proxy
 */

/** convex/convex.config.ts */
export function generateConvexConvexConfig(): string {
	return `import { defineApp } from "convex/server";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp();

app.use(betterAuth);

export default app;
`;
}

/** convex/auth.config.ts */
export function generateConvexAuthConfigTs(): string {
	return `import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

export default {
	providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
`;
}

/** convex/http.ts */
export function generateConvexHttp(): string {
	return `import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth/auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

export default http;
`;
}

/** convex/betterAuth/convex.config.ts */
export function generateConvexBetterAuthComponentConfig(): string {
	return `import { defineComponent } from "convex/server";

const component = defineComponent("betterAuth");

export default component;
`;
}

/** convex/betterAuth/auth.ts */
export function generateConvexBetterAuthModule(): string {
	return `import { createClient } from "@convex-dev/better-auth";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import schema from "./schema";

export const authComponent = createClient<DataModel, typeof schema>(
	components.betterAuth,
	{
		local: { schema },
		verbose: false,
	},
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
	return {
		appName: "My App",
		baseURL: process.env.SITE_URL,
		secret: process.env.BETTER_AUTH_SECRET,
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: false,
		},
		plugins: [
			emailOTP({
				async sendVerificationOTP({ email, otp }) {
					const apiKey = process.env.RESEND_API_KEY;
					const from = process.env.EMAIL_FROM || "noreply@example.com";

					if (!apiKey) {
						console.log(\`[DEV] OTP for \${email}: \${otp}\`);
						return;
					}

					const res = await fetch("https://api.resend.com/emails", {
						method: "POST",
						headers: {
							Authorization: \`Bearer \${apiKey}\`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							from,
							to: [email],
							subject: "Your verification code",
							html: \`<p>Your verification code is: <strong>\${otp}</strong></p>\`,
						}),
					});

					if (!res.ok) {
						const text = await res.text();
						console.error(\`Failed to send OTP email: \${res.status} \${text}\`);
						throw new Error("Failed to send verification email");
					}
				},
			}),
		],
	} satisfies BetterAuthOptions;
};

export const options = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth(createAuthOptions(ctx));
};
`;
}

/** convex/betterAuth/schema.ts – Better Auth component schema (auth tables) */
export function generateConvexBetterAuthSchema(): string {
	return `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	user: defineTable({
		email: v.string(),
		name: v.optional(v.string()),
		emailVerified: v.boolean(),
		image: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_email", ["email"]),

	session: defineTable({
		userId: v.string(),
		token: v.string(),
		expiresAt: v.number(),
		ipAddress: v.optional(v.string()),
		userAgent: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_token", ["token"])
		.index("by_userId", ["userId"]),

	account: defineTable({
		userId: v.string(),
		accountId: v.string(),
		providerId: v.string(),
		accessToken: v.optional(v.string()),
		refreshToken: v.optional(v.string()),
		accessTokenExpiresAt: v.optional(v.number()),
		refreshTokenExpiresAt: v.optional(v.number()),
		scope: v.optional(v.string()),
		idToken: v.optional(v.string()),
		password: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_userId", ["userId"])
		.index("by_providerId_accountId", ["providerId", "accountId"]),

	verification: defineTable({
		identifier: v.string(),
		value: v.string(),
		expiresAt: v.number(),
		createdAt: v.optional(v.number()),
		updatedAt: v.optional(v.number()),
	}).index("by_identifier", ["identifier"]),

	jwks: defineTable({
		publicKey: v.string(),
		privateKey: v.string(),
		createdAt: v.number(),
		expiresAt: v.optional(v.number()),
		alg: v.optional(v.string()),
		crv: v.optional(v.string()),
	}),
});
`;
}

/** convex/betterAuth/adapter.ts – CRUD API used by the component */
export function generateConvexBetterAuthAdapter(): string {
	return `import { createApi } from "@convex-dev/better-auth";
import { createAuthOptions } from "./auth";
import schema from "./schema";

export const {
	create,
	findOne,
	findMany,
	updateOne,
	updateMany,
	deleteOne,
	deleteMany,
} = createApi(schema, createAuthOptions);
`;
}

/** lib/auth.ts – Server-side auth helpers for Next.js */
export function generateConvexAuthConfig(): string {
	return `import { cache } from "react";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexAuth = convexBetterAuthNextJs({
	convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL as string,
	convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL as string,
});

export const {
	handler,
	isAuthenticated,
	getToken,
	fetchAuthQuery,
	fetchAuthMutation,
	fetchAuthAction,
} = convexAuth;

export type Session = {
	user: {
		id: string;
		email: string;
		name: string;
		image?: string | null;
	};
};

/**
 * Per-request cached session getter.
 * Validates the Better Auth cookie by calling the Convex backend.
 */
export const getSession = cache(async () => {
	const { headers } = await import("next/headers");
	const hdrs = await headers();
	const cookieHeader = hdrs.get("cookie") ?? "";

	try {
		const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL as string;
		const res = await fetch(\`\${siteUrl}/api/auth/get-session\`, {
			headers: { cookie: cookieHeader },
		});
		if (!res.ok) return null;
		const data = await res.json();
		return data as Session | null;
	} catch {
		return null;
	}
});

/**
 * Compatibility wrapper for Better Auth patterns.
 * Allows existing code to use auth.api.getSession({ headers }).
 */
export const auth = {
	api: {
		getSession: async (opts: { headers: Headers }) => {
			const cookieHeader = opts.headers.get("cookie") ?? "";
			try {
				const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL as string;
				const res = await fetch(\`\${siteUrl}/api/auth/get-session\`, {
					headers: { cookie: cookieHeader },
				});
				if (!res.ok) return null;
				return (await res.json()) as Session | null;
			} catch {
				return null;
			}
		},
	},
};
`;
}

/** lib/auth-client.ts – Client auth with Convex plugin */
export function generateConvexAuthClient(): string {
	return `import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

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
	plugins: [convexClient(), emailOTPClient()],
});

export const { signIn, signOut, useSession } = authClient;
`;
}

/** app/api/auth/[...all]/route.ts – Proxies to Convex backend */
export function generateConvexAuthRouteHandler(): string {
	return `import { handler } from "@/lib/auth";

export const { GET, POST } = handler;
`;
}
