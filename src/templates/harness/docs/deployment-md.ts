export function generateDocsDeployment(name: string): string {
	return `# Deployment

## Environment Matrix

| Environment | Frontend | Backend | When Used |
|-------------|----------|---------|-----------|
| Production | Vercel (main branch) | Convex production deployment | Live users |
| Preview | Vercel preview deployment | Convex preview deploy key | Pull requests |
| Development | localhost:3000 | Convex dev (\`npx convex dev\`) | Local development |
| Feature VM | exe.dev VM | Convex preview deploy key | Isolated feature work |

## Production Deploy

1. Merge PR to \`main\` branch
2. Vercel auto-deploys the frontend from \`main\`
3. Convex deploys via CI (production deployment)

No manual steps required once CI is configured.

## Preview Deploys

When a pull request is opened:

1. Vercel creates a preview deployment automatically
2. Convex uses a preview deploy key to create an isolated backend
3. The preview deployment gets its own Convex database and functions
4. The preview deploy key is set as \`CONVEX_DEPLOY_KEY\` in Vercel project environment variables

## Required Environment Variables by Environment

### Production (set in Vercel project settings)
- \`NEXT_PUBLIC_CONVEX_URL\` — Production Convex URL
- \`CONVEX_DEPLOYMENT\` — Production deployment identifier
- \`OPENAI_API_KEY\`
- \`BETTER_AUTH_SECRET\`
- \`RESEND_API_KEY\`
- \`NEXT_PUBLIC_POSTHOG_KEY\` (optional)

### Preview (set in Vercel project settings, preview scope)
- \`CONVEX_DEPLOY_KEY\` — Preview deploy key from Convex dashboard
- All other variables same as production (or preview-specific values)

### Development (\`apps/web/.env.local\`)
- \`NEXT_PUBLIC_CONVEX_URL\`
- \`CONVEX_DEPLOYMENT\`
- \`OPENAI_API_KEY\`
- \`BETTER_AUTH_SECRET\`
- \`RESEND_API_KEY\`

## First-Time Setup

1. Clone the repository:
   \`\`\`bash
   git clone <repo-url> ${name}
   cd ${name}
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   pnpm install
   \`\`\`

3. Create your environment file:
   \`\`\`bash
   cp apps/web/.env.local.example apps/web/.env.local
   \`\`\`

4. Fill in the required environment variables in \`apps/web/.env.local\`

5. Start the Convex development server:
   \`\`\`bash
   npx convex dev
   \`\`\`

6. In a separate terminal, start the Next.js dev server:
   \`\`\`bash
   pnpm dev
   \`\`\`
`;
}
