export function generateBetterAuthConfig(): string {
	return `import { cache } from "react";
import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { Resend } from "resend";

// Lazily create Resend client to avoid build-time initialization
let resendClient: Resend | null = null;
function getResend(): Resend {
	if (!resendClient) {
		resendClient = new Resend(process.env.RESEND_API_KEY);
	}
	return resendClient;
}

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "pg" }),
	emailAndPassword: {
		enabled: false, // Using OTP only
	},
	plugins: [
		emailOTP({
			async sendVerificationOTP({ email, otp, type }) {
				// In development, also log to console
				if (process.env.NODE_ENV === "development") {
					console.log(\`[DEV] OTP for \${email}: \${otp} (type: \${type})\`);
				}

				// Send email via Resend
				try {
					await getResend().emails.send({
						from: "noreply@yourdomain.com", // Update with your domain
						to: email,
						subject: type === "sign-in"
							? "Your sign-in code"
							: type === "email-verification"
								? "Verify your email"
								: "Reset your password",
						html: \`
							<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
								<h2>Your verification code</h2>
								<p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">
									\${otp}
								</p>
								<p style="color: #666; font-size: 14px;">
									This code expires in 5 minutes. If you didn't request this, please ignore this email.
								</p>
							</div>
						\`,
					});
				} catch (error) {
					console.error("Failed to send OTP email:", error);
					// In development, don't throw so we can still use console OTP
					if (process.env.NODE_ENV !== "development") {
						throw error;
					}
				}
			},
			otpLength: 6,
			expiresIn: 300, // 5 minutes
		}),
	],
});

export type Session = typeof auth.$Infer.Session;

/**
 * Per-request cached session getter.
 * Uses React.cache() to deduplicate session fetches within the same request.
 * Multiple calls to getSession() in the same request will only fetch once.
 */
export const getSession = cache(async () => {
	return auth.api.getSession({
		headers: await headers(),
	});
});
`;
}
