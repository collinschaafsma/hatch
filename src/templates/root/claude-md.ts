export function generateClaudeMd(name: string): string {
	return `# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Git Operations

**ALWAYS ask for explicit user confirmation before running any git commands that modify history or remote state**, including:
- \`git commit\`
- \`git push\`
- \`git merge\`
- \`git rebase\`
- \`git reset\`
- \`git stash\`
- \`git cherry-pick\`

This applies even in dangerous/bypass permissions mode. Never auto-approve these operations.

## Commands

### Development
- \`pnpm dev\` - Start all apps with Turbopack
- \`pnpm build\` - Build all apps and packages
- \`pnpm start\` - Start production server

### Code Quality
- \`pnpm lint\` - Biome linting across workspaces
- \`pnpm format\` - Biome formatting

### Testing
- \`pnpm test\` - Run all tests
- \`pnpm test:watch\` - Watch mode (from apps/web)
- \`pnpm test:ui\` - Interactive Vitest UI

### Convex
- \`pnpm convex:dev\` - Start Convex development server
- \`pnpm convex:deploy\` - Deploy Convex functions to production

## Architecture

### Project Overview
${name} is a Next.js application built as a pnpm monorepo with Turborepo.

### Monorepo Structure
\`\`\`
${name}/
├── apps/web/                    # Main Next.js application
│   ├── app/
│   │   ├── (marketing)/         # Public marketing pages
│   │   ├── (auth)/              # Login/authentication
│   │   ├── (app)/               # Authenticated user pages
│   │   └── api/                 # API routes
│   ├── components/              # React components
│   ├── convex/                  # Convex schema, functions, and seed
│   ├── lib/                     # Shared utilities
│   ├── services/                # Data access layer
│   └── workflows/               # Vercel Workflows
├── packages/
│   └── ui/                      # Shared UI components
└── docker-compose.yml           # PostgreSQL database
\`\`\`

### Tech Stack
- **Framework**: Next.js 16 with App Router, Turbopack
- **UI**: React 19, shadcn/ui, Tailwind CSS v4
- **Database**: Convex (serverless backend)
- **Auth**: Better Auth (Email OTP)
- **AI**: Vercel AI SDK with OpenAI
- **Workflows**: Vercel Workflow DevKit
- **Testing**: Vitest

## Key Conventions

### Server/Client Data Fetching Pattern
In server components, create promises but DO NOT await them. Pass promises to client components wrapped in Suspense. Client components unwrap with React's \`use\` hook. Always use service layer for database access.

### Route Groups
- \`(marketing)/\` - Public pages
- \`(auth)/\` - Login/authentication
- \`(app)/\` - Authenticated pages (protected by middleware)

### Workspace Dependencies
- \`@workspace/*\` protocol for internal packages
- Path aliases: \`@/*\` for app root

### Vercel Workflows
All I/O operations inside a workflow MUST be wrapped in functions marked with \`"use step"\`. The workflow engine needs this to properly track, retry, and resume operations.

\`\`\`typescript
// CORRECT - wrapped in step function
async function fetchData(id: string) {
  "use step";
  return getDataFromDb(id);
}

export async function myWorkflow(input) {
  "use workflow";
  const data = await fetchData(id);
}
\`\`\`

## Environment Variables

Required (stored in \`apps/web/.env.local\`):
- \`NEXT_PUBLIC_CONVEX_URL\` - Convex deployment URL
- \`CONVEX_DEPLOYMENT\` - Convex deployment identifier
- \`OPENAI_API_KEY\` - For AI features
- \`BETTER_AUTH_SECRET\` - Auth secret key
- \`RESEND_API_KEY\` - For email OTP
- \`NEXT_PUBLIC_POSTHOG_KEY\` - PostHog analytics (optional)

## Development Workflow

### First-time Setup
1. \`pnpm install\`
2. \`pnpm docker:up\`
3. \`cp apps/web/.env.local.example apps/web/.env.local\`
4. Fill in environment variables
5. \`pnpm db:generate && pnpm db:migrate\`

### Daily Development
1. \`pnpm docker:up\` (if not running)
2. \`pnpm dev\`

### Schema Changes
1. Edit \`apps/web/convex/schema.ts\`
2. \`pnpm convex:dev\` (auto-deploys schema changes)

## Service Layer

All database access goes through service files in \`apps/web/services/\`. Never call \`db\` directly from components or server actions.

## Browser Automation

Use \`agent-browser\` for web automation. Run \`agent-browser --help\` for all commands.

Core workflow:
1. \`agent-browser open <url>\` - Navigate to page
2. \`agent-browser snapshot -i\` - Get interactive elements with refs (@e1, @e2)
3. \`agent-browser click @e1\` / \`fill @e2 "text"\` - Interact using refs
4. Re-snapshot after page changes
`;
}
