export function generateEnvExample(
	useWorkOS: boolean,
	projectName: string,
): string {
	const authEnv = useWorkOS
		? `# WorkOS
WORKOS_CLIENT_ID=
WORKOS_API_KEY=
WORKOS_COOKIE_PASSWORD=  # Generate with: openssl rand -base64 32
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/callback`
		: `# Better Auth
BETTER_AUTH_SECRET=  # Generate with: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000

# Resend (for email OTP)
RESEND_API_KEY=`;

	return `# Database (Supabase)
# Production: Set in Vercel environment variables from Supabase dashboard
# Development: Run 'pnpm supabase:env dev' to populate these
DATABASE_URL=

# Test Database (Supabase branch)
TEST_DATABASE_URL=

${authEnv}

# Vercel AI Gateway (https://vercel.com/docs/ai-gateway)
AI_GATEWAY_API_KEY=

# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=  # PostHog project API key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # or https://eu.i.posthog.com
POSTHOG_API_KEY=  # Server-side key (often same as NEXT_PUBLIC_POSTHOG_KEY)

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;
}
