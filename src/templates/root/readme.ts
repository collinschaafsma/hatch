export function generateReadme(projectName: string): string {
	return `# ${projectName}

A full-stack monorepo built with [Hatch](https://github.com/collinschaafsma/hatch).

## Quick Start

### Prerequisites

- [Node.js 22+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) (\`corepack enable\`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for cloud database)

### Automated Setup (Recommended)

Run the interactive setup script to configure GitHub, Vercel, and Supabase:

\`\`\`bash
pnpm app:setup
\`\`\`

This will:
- Create a GitHub repository (or link to existing)
- Set up a Vercel project
- Create a Supabase project with dev branches
- Pull environment variables

### Manual Setup

1. Copy the environment template:
   \`\`\`bash
   cp apps/web/.env.local.example apps/web/.env.local
   \`\`\`

2. Fill in your environment variables in \`apps/web/.env.local\`

3. Set up Supabase:
   \`\`\`bash
   pnpm supabase:setup
   \`\`\`

4. Start the development server:
   \`\`\`bash
   pnpm dev
   \`\`\`

---

## Project Structure

\`\`\`
${projectName}/
├── apps/
│   └── web/              # Next.js application
│       ├── app/          # App router pages
│       ├── components/   # React components
│       ├── db/           # Drizzle schema and client
│       ├── hooks/        # Custom React hooks
│       ├── lib/          # Utilities and auth
│       ├── services/     # Business logic layer
│       ├── workflows/    # Vercel Workflow DevKit
│       ├── evals/        # LLM evaluation tests
│       └── __tests__/    # Vitest tests
├── packages/
│   └── ui/               # Shared UI components
├── scripts/              # Setup scripts
└── supabase/             # Supabase configuration
└── .github/workflows/   # CI/CD workflows
\`\`\`

---

## Development Commands

| Command | Description |
|---------|-------------|
| \`pnpm dev\` | Start Next.js development server (with Turbopack) |
| \`pnpm build\` | Build all packages for production |
| \`pnpm lint\` | Run Biome linting |
| \`pnpm typecheck\` | Run TypeScript type checking |
| \`pnpm format\` | Auto-format code with Biome |
| \`pnpm check\` | Run all Biome checks |
| \`pnpm test\` | Run Vitest tests |
| \`pnpm test:ui\` | Run tests with Vitest UI |

---

## Database Commands

| Command | Description |
|---------|-------------|
| \`pnpm db:generate\` | Generate Drizzle migration files |
| \`pnpm db:migrate\` | Apply pending migrations |
| \`pnpm db:push\` | Push schema directly (dev only) |
| \`pnpm db:studio\` | Open Drizzle Studio GUI |

---

## Supabase Commands

| Command | Description |
|---------|-------------|
| \`pnpm supabase:setup\` | Link or create Supabase project with dev branches |
| \`pnpm supabase:branch <cmd> <name>\` | Manage database branches (create/delete/list) |
| \`pnpm supabase:env [branch]\` | Fetch credentials for a branch (default: dev) |

---

## Running Tests

Tests use a separate Supabase database branch to avoid affecting development data.

\`\`\`bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm --filter web test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm --filter web test:coverage
\`\`\`

---

## Environment Variables

Copy \`apps/web/.env.local.example\` to \`apps/web/.env.local\` and configure:

### Database
- \`DATABASE_URL\` - PostgreSQL connection string
- \`TEST_DATABASE_URL\` - Test database connection string

### Authentication
Better Auth (Email OTP) or WorkOS:
- \`BETTER_AUTH_SECRET\` - Auth encryption secret
- \`BETTER_AUTH_URL\` - Auth callback URL
- \`RESEND_API_KEY\` - Email service for OTP (get your key at [resend.com](https://resend.com))

### AI
- \`AI_GATEWAY_API_KEY\` - Vercel AI Gateway key (get your key at [vercel.com/ai-gateway](https://vercel.com/dashboard/~/ai))

### Analytics
- \`NEXT_PUBLIC_POSTHOG_KEY\` - PostHog public key
- \`NEXT_PUBLIC_POSTHOG_HOST\` - PostHog host
- \`POSTHOG_API_KEY\` - PostHog server-side key

---

## CI/CD (GitHub Actions)

| Workflow | Trigger | Description |
|----------|---------|-------------|
| \`checks.yml\` | Pull request | Runs linting and type checking |
| \`test.yml\` | Pull request | Runs Vitest tests with PostgreSQL |
| \`claude-code-review.yml\` | Pull request | AI-powered code review |
| \`claude.yml\` | \`@claude\` mention | Interactive Claude in issues/PRs |

### Claude Integration

Mention \`@claude\` in any issue or PR comment to get AI assistance:
- Code explanations
- Bug analysis
- Implementation suggestions
- Review feedback

---

## Workflows

This project includes [Vercel Workflow DevKit](https://vercel.com/docs/workflow-kit) for durable, long-running AI workflows.

### Example Workflow

The included example workflow (\`workflows/example.ts\`) demonstrates:
- Multi-step AI processing with OpenAI
- Real-time progress streaming via SSE
- Error handling and retry logic

### Progress Streaming

Workflows emit real-time progress events that the UI consumes via Server-Sent Events:

\`\`\`
Client                    Server
  │                         │
  ├─ POST /api/workflow ───►│  Start workflow, get runId
  │◄── { runId } ───────────┤
  │                         │
  ├─ GET /api/workflow-progress/[runId] ──►│
  │◄── SSE: step 1/5 ───────┤
  │◄── SSE: step 2/5 ───────┤
  │◄── SSE: completed ──────┤
\`\`\`

Key files:
- \`workflows/example.ts\` - Workflow definition with progress emits
- \`app/api/workflow/route.ts\` - Starts workflow runs
- \`app/api/workflow-progress/[runId]/route.ts\` - SSE progress stream
- \`hooks/use-workflow-progress.ts\` - React hook for consuming progress
- \`lib/workflow-progress/types.ts\` - Shared progress types

### Monitoring

View workflow runs in the browser:

\`\`\`bash
npx workflow web
\`\`\`

---

## Database Environments

This project uses Supabase with database branching for isolated environments:

| Environment | Database | Purpose |
|-------------|----------|---------|
| **Production** | Main Supabase database | Live application |
| **Preview** | Auto-created per PR | Vercel preview deployments (via Supabase Integration) |
| **Development** | \`dev\` branch | Local development (\`.env.local\`) |
| **Tests** | \`dev-test\` branch | Local test runs |

### Preview Deployments

The Supabase Vercel Integration automatically:
1. Creates a database branch when Vercel builds a preview
2. Injects the correct \`DATABASE_URL\` into that deployment
3. Cleans up the branch when the preview is deleted

This means each PR gets its own isolated database - no conflicts between concurrent feature development.

To set up the integration (if not done during setup):
\`\`\`bash
supabase integrations create vercel
\`\`\`

Or configure it at: \`https://supabase.com/dashboard/project/<ref>/settings/integrations\`

---

## Deployment

### Vercel

The project is configured for Vercel deployment:

1. Link your project:
   \`\`\`bash
   vercel link
   \`\`\`

2. Set environment variables in Vercel dashboard (copy DATABASE_URL from Supabase)

3. Deploy:
   \`\`\`bash
   vercel --prod
   \`\`\`

Database migrations run automatically during the build process via \`vercel.json\`:
\`\`\`json
{
  "buildCommand": "pnpm db:migrate:deploy && pnpm build"
}
\`\`\`

---

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) with React 19
- **Database:** [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL
- **Auth:** [Better Auth](https://www.better-auth.com/) (Email OTP via Resend)
- **AI:** [Vercel AI SDK](https://sdk.vercel.ai/) with OpenAI
- **Workflows:** [Vercel Workflow DevKit](https://vercel.com/docs/workflow-kit)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Testing:** [Vitest](https://vitest.dev/)
- **Monorepo:** [Turborepo](https://turbo.build/repo)
- **Linting:** [Biome](https://biomejs.dev/)

---

## License

Private
`;
}
