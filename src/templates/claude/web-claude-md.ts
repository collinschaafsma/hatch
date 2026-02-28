export function generateWebClaudeMd(): string {
	return `# apps/web

## Package Scripts

- \`pnpm dev\` — Start Next.js with Turbopack (from monorepo root)
- \`pnpm --filter web dev\` — Start only the web app
- \`pnpm --filter web build\` — Build the web app
- \`pnpm --filter web test\` — Run web app tests
- \`pnpm --filter web typecheck\` — Type-check the web app

## Environment Setup

Copy \`.env.local.example\` to \`.env.local\` and fill in the required values:
- \`CONVEX_DEPLOYMENT\` — Convex deployment URL (set by \`npx convex dev\`)
- \`NEXT_PUBLIC_CONVEX_URL\` — Public Convex URL for the client
- \`RESEND_API_KEY\` — For email OTP authentication
- \`BETTER_AUTH_SECRET\` — Secret for Better Auth session signing

## Troubleshooting

See \`docs/troubleshooting.md\` for common issues and solutions.

If Convex types are missing or stale, run \`npx convex dev\` to regenerate \`convex/_generated/\`.
`;
}
