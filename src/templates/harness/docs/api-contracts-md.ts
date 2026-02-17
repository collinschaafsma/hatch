export function generateDocsApiContracts(): string {
	return `# API Contracts

## API Routes

| Path | Method | Auth Required | Description |
|------|--------|---------------|-------------|
| \`/api/auth/[...all]\` | ALL | No | Better Auth handler (login, signup, OTP, session) |
| \`/api/chat\` | POST | Yes | AI chat endpoint (Vercel AI SDK streaming) |
| \`/api/workflow\` | POST | Yes | Workflow trigger endpoint |
| \`/api/workflow-progress/[runId]\` | GET | Yes | Workflow SSE progress stream |

## Convex Schema

The canonical schema is defined in \`apps/web/convex/schema.ts\`. All Convex queries, mutations, and actions are typed against this schema. Do not duplicate schema definitions elsewhere.

## Service Function Signatures

<!-- Add service function signatures as they are created -->
<!-- Example:
  getItems(): Promise<Item[]>
  getItemById(id: string): Promise<Item | null>
  createItem(input: CreateItemInput): Promise<Item>
-->

_To be documented by the team as services are implemented._

## Environment Variables

| Variable | Where Used | How to Obtain |
|----------|-----------|---------------|
| \`NEXT_PUBLIC_CONVEX_URL\` | Convex client, services | Convex dashboard → Deployment URL |
| \`CONVEX_DEPLOYMENT\` | Convex CLI, deploy scripts | Convex dashboard → Deployment identifier |
| \`OPENAI_API_KEY\` | AI chat endpoint | OpenAI platform → API keys |
| \`BETTER_AUTH_SECRET\` | Auth session signing | Generate with \`openssl rand -hex 32\` |
| \`RESEND_API_KEY\` | Email OTP delivery | Resend dashboard → API keys |
| \`NEXT_PUBLIC_POSTHOG_KEY\` | Analytics (optional) | PostHog dashboard → Project API key |
`;
}
