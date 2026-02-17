export function generateDocsApiContracts(): string {
	return `# API Contracts

## API Routes

| Path | Method | Auth Required | Description |
|------|--------|---------------|-------------|
| \`/api/auth/[...all]\` | ALL | No | Better Auth handler (login, signup, OTP, session) |

## Convex Functions

| Function | Type | Auth Required | Description |
|----------|------|---------------|-------------|
| \`workflows.startRun\` | Mutation | No | Start a new AI workflow run |
| \`workflows.getRun\` | Query | No | Get workflow run status and result |

## Convex Schema

The canonical schema is defined in \`apps/web/convex/schema.ts\`. All Convex queries, mutations, and actions are typed against this schema. Do not duplicate schema definitions elsewhere.

## Environment Variables

| Variable | Where Used | How to Obtain |
|----------|-----------|---------------|
| \`NEXT_PUBLIC_CONVEX_URL\` | Convex client | Convex dashboard → Deployment URL |
| \`CONVEX_DEPLOYMENT\` | Convex CLI, deploy scripts | Convex dashboard → Deployment identifier |
| \`OPENAI_API_KEY\` | AI workflow action | OpenAI platform → API keys |
| \`BETTER_AUTH_SECRET\` | Auth session signing | Generate with \`openssl rand -hex 32\` |
| \`RESEND_API_KEY\` | Email OTP delivery | Resend dashboard → API keys |
| \`NEXT_PUBLIC_POSTHOG_KEY\` | Analytics (optional) | PostHog dashboard → Project API key |
`;
}
