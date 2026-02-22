/**
 * Template for convex/devAuth.ts — a dev-only HTTP action that
 * authenticates Agent Browser by driving BetterAuth's OTP flow internally.
 *
 * Guarded by HATCH_DEV_MODE env var (only set on feature/spike VMs).
 */
export function generateConvexDevAuth(): string {
	return `import { httpActionGeneric } from "convex/server";
import { authComponent, createAuth } from "./betterAuth/auth";

const DEV_EMAIL = "dev@test.local";

/**
 * Dev-only endpoint that creates an authenticated session for Agent Browser.
 * Drives BetterAuth's own OTP flow internally: send OTP → read OTP → verify OTP → return session cookie.
 *
 * Guarded by HATCH_DEV_MODE env var — returns 403 on production deployments.
 */
// biome-ignore lint/suspicious/noExplicitAny: ctx type provided by Convex codegen at runtime
const devAuth = httpActionGeneric(async (ctx: any) => {
	if (process.env.HATCH_DEV_MODE !== "true") {
		return new Response(JSON.stringify({ error: "Not available" }), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const auth = createAuth(ctx);

		// Step 1: Send OTP to the dev email (won't actually send — no RESEND_API_KEY on preview)
		await auth.api.sendVerificationOTP({
			body: { email: DEV_EMAIL, type: "sign-in" },
		});

		// Step 2: Read the OTP from the verification table
		// biome-ignore lint/suspicious/noExplicitAny: adapter returns AdapterFactory, findOne exists at runtime
		const adapter: any = authComponent.adapter(ctx);
		const verification = await adapter.findOne({
			model: "verification",
			where: [{ field: "identifier", value: DEV_EMAIL }],
		});

		if (!verification?.value) {
			return new Response(
				JSON.stringify({ error: "Could not retrieve OTP" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}

		// Step 3: Verify OTP — BetterAuth creates the session and returns Set-Cookie header
		const response = await auth.api.signInEmailOTP({
			body: { email: DEV_EMAIL, otp: verification.value },
			asResponse: true,
		});

		return response;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return new Response(
			JSON.stringify({ error: "Dev auth failed", details: message }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
});

export default devAuth;
`;
}
