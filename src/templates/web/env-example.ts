export function generateEnvExample(projectName: string): string {
	return `# Convex
CONVEX_DEPLOYMENT=  # Set by 'npx convex dev'
NEXT_PUBLIC_CONVEX_URL=  # Set by 'npx convex dev'
NEXT_PUBLIC_CONVEX_SITE_URL=  # Set by 'npx convex dev' (e.g. https://adjective-animal-123.convex.site)

# Better Auth
BETTER_AUTH_SECRET=  # Generate with: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000

# Resend (for email OTP)
RESEND_API_KEY=

# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=  # PostHog project API key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # or https://eu.i.posthog.com
POSTHOG_API_KEY=  # Server-side key (often same as NEXT_PUBLIC_POSTHOG_KEY)

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;
}
