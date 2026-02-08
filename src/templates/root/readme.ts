export function generateReadme(projectName: string, useConvex = false): string {
	const prerequisites = useConvex
		? `- [Node.js 22+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) (\`corepack enable\`)`
		: `- [Node.js 22+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) (\`corepack enable\`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for cloud database)`;

	const automatedSetupDesc = useConvex
		? `This will:
- Create a GitHub repository (or link to existing)
- Set up a Vercel project
- Create a Convex project and deploy schema
- Pull environment variables`
		: `This will:
- Create a GitHub repository (or link to existing)
- Set up a Vercel project
- Create a Supabase project with dev branches
- Pull environment variables`;

	const manualSetupBackend = useConvex
		? `3. Start the Convex dev server (in a separate terminal):
   \`\`\`bash
   pnpm convex:dev
   \`\`\`

4. Start the development server:
   \`\`\`bash
   pnpm dev
   \`\`\``
		: `3. Set up Supabase:
   \`\`\`bash
   pnpm supabase:setup
   \`\`\`

4. Start the development server:
   \`\`\`bash
   pnpm dev
   \`\`\``;

	const projectTree = useConvex
		? `\`\`\`
${projectName}/
├── apps/
│   └── web/              # Next.js application
│       ├── app/          # App router pages
│       ├── components/   # React components
│       ├── convex/       # Convex schema, functions, and seed
│       ├── hooks/        # Custom React hooks
│       ├── lib/          # Utilities and auth
│       ├── services/     # Business logic layer
│       ├── workflows/    # Vercel Workflow DevKit
│       └── __tests__/    # Vitest tests
├── packages/
│   └── ui/               # Shared UI components
├── scripts/              # Setup scripts
└── .github/workflows/    # CI/CD workflows
\`\`\``
		: `\`\`\`
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
│       └── __tests__/    # Vitest tests
├── packages/
│   └── ui/               # Shared UI components
├── scripts/              # Setup scripts
├── supabase/             # Supabase configuration
└── .github/workflows/    # CI/CD workflows
\`\`\``;

	const backendCommands = useConvex
		? `## Convex Commands

| Command | Description |
|---------|-------------|
| \`pnpm convex:dev\` | Start Convex development server (auto-syncs schema) |
| \`pnpm convex:deploy\` | Deploy Convex functions to production |`
		: `## Database Commands

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
| \`pnpm supabase:env [branch]\` | Fetch credentials for a branch (default: dev) |`;

	const testingNotes = useConvex
		? `Tests use Vitest. Convex functions can be tested using the Convex test utilities.

\`\`\`bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm --filter web test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm --filter web test:coverage
\`\`\``
		: `Tests use a separate Supabase database branch to avoid affecting development data.

\`\`\`bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm --filter web test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm --filter web test:coverage
\`\`\``;

	const envVarsBackend = useConvex
		? `### Convex
- \`NEXT_PUBLIC_CONVEX_URL\` - Convex deployment URL (set by \`npx convex dev\`)
- \`NEXT_PUBLIC_CONVEX_SITE_URL\` - Convex HTTP actions URL (e.g. \`https://adjective-animal-123.convex.site\`)
- \`CONVEX_DEPLOY_KEY\` - Deploy key for production deployments (Vercel env var)`
		: `### Database
- \`DATABASE_URL\` - PostgreSQL connection string
- \`TEST_DATABASE_URL\` - Test database connection string`;

	const envVarsAuth = useConvex
		? `### Authentication
Better Auth (runs inside Convex):
- \`BETTER_AUTH_SECRET\` - Auth encryption secret (set as Convex env var)
- \`SITE_URL\` - App URL for auth callbacks (set as Convex env var)
- \`BETTER_AUTH_URL\` - Auth callback URL`
		: `### Authentication
Better Auth (Email OTP) or WorkOS:
- \`BETTER_AUTH_SECRET\` - Auth encryption secret
- \`BETTER_AUTH_URL\` - Auth callback URL
- \`RESEND_API_KEY\` - Email service for OTP (get your key at [resend.com](https://resend.com))`;

	const environmentsSection = useConvex
		? `## Backend Environments

This project uses Convex with separate projects for isolated environments:

| Environment | Backend | Purpose |
|-------------|---------|---------|
| **Production** | Main Convex project | Live application (deployed via Vercel build) |
| **Preview** | Separate Convex project per branch | Vercel preview deployments |
| **Development** | Dev deployment | Local development (\`npx convex dev\`) |
| **Feature VMs** | Separate Convex project | Isolated feature development (created by \`hatch feature\`) |

### Production Deployments

When code is merged to main, Vercel automatically:
1. Runs \`npx convex deploy\` to deploy schema and functions
2. Builds the Next.js application
3. Deploys to Vercel

### Preview Deployments

Each feature branch gets its own Convex project so preview deployments are fully isolated. This is managed automatically by \`hatch feature\`:

1. **Per-branch env vars** — \`hatch feature\` sets \`CONVEX_DEPLOY_KEY\`, \`NEXT_PUBLIC_CONVEX_URL\`, and \`NEXT_PUBLIC_CONVEX_SITE_URL\` as Vercel env vars scoped to the feature branch's preview deployments via the Vercel API.

2. **Build command** — \`vercel.json\` uses a conditional build:
   - **Production**: \`npx convex deploy && pnpm build\` deploys to the main Convex project.
   - **Preview**: Unsets \`VERCEL\` and \`VERCEL_ENV\` before running \`npx convex deploy\` so the Convex CLI accepts the feature project's production deploy key in a non-production Vercel environment. The Next.js build runs separately so Vercel Workflow DevKit can detect the Vercel environment.

3. **Auth URL resolution** — The auth client uses \`window.location.origin\` in the browser so auth requests always target the current deployment's origin. This avoids CORS mismatches between preview URLs. The Convex backend's Better Auth config includes \`trustedOrigins\` with \`*.vercel.app\` and \`*.exe.xyz\` wildcards to accept requests from any preview or VM origin.

4. **Cleanup** — \`hatch clean\` removes the per-branch Vercel env vars and deletes the feature Convex project.

The \`CONVEX_DEPLOY_KEY\` env var in Vercel authorizes the deployment.`
		: `## Database Environments

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

Or configure it at: \`https://supabase.com/dashboard/project/<ref>/settings/integrations\``;

	const deploymentSection = useConvex
		? `## Deployment

### Vercel

The project is configured for Vercel deployment with automatic Convex deploys:

1. Link your project:
   \`\`\`bash
   vercel link
   \`\`\`

2. Set environment variables in Vercel dashboard:
   - \`CONVEX_DEPLOY_KEY\` - Production deploy key from Convex dashboard
   - \`NEXT_PUBLIC_CONVEX_URL\` - Convex deployment URL
   - \`NEXT_PUBLIC_CONVEX_SITE_URL\` - Convex HTTP actions URL

3. Deploy:
   \`\`\`bash
   vercel --prod
   \`\`\`

Convex functions deploy automatically during the build via \`vercel.json\`. See [Preview Deployments](#preview-deployments) above for how preview builds are handled.`
		: `## Deployment

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
\`\`\``;

	const techStack = useConvex
		? `- **Framework:** [Next.js 16](https://nextjs.org/) with React 19
- **Backend:** [Convex](https://www.convex.dev/) (real-time database + serverless functions)
- **Auth:** [Better Auth](https://www.better-auth.com/) via [@convex-dev/better-auth](https://github.com/get-convex/convex-better-auth)
- **AI:** [Vercel AI SDK](https://sdk.vercel.ai/) with OpenAI
- **Workflows:** [Vercel Workflow DevKit](https://vercel.com/docs/workflow-kit)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Testing:** [Vitest](https://vitest.dev/)
- **Monorepo:** [Turborepo](https://turbo.build/repo)
- **Linting:** [Biome](https://biomejs.dev/)`
		: `- **Framework:** [Next.js 16](https://nextjs.org/) with React 19
- **Database:** [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL
- **Auth:** [Better Auth](https://www.better-auth.com/) (Email OTP via Resend)
- **AI:** [Vercel AI SDK](https://sdk.vercel.ai/) with OpenAI
- **Workflows:** [Vercel Workflow DevKit](https://vercel.com/docs/workflow-kit)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Testing:** [Vitest](https://vitest.dev/)
- **Monorepo:** [Turborepo](https://turbo.build/repo)
- **Linting:** [Biome](https://biomejs.dev/)`;

	return `# ${projectName}

A full-stack monorepo built with [Hatch](https://github.com/collinschaafsma/hatch).

## Quick Start

### Prerequisites

${prerequisites}

### Automated Setup (Recommended)

Run the interactive setup script to configure GitHub, Vercel, and ${useConvex ? "Convex" : "Supabase"}:

\`\`\`bash
pnpm app:setup
\`\`\`

${automatedSetupDesc}

### Manual Setup

1. Copy the environment template:
   \`\`\`bash
   cp apps/web/.env.local.example apps/web/.env.local
   \`\`\`

2. Fill in your environment variables in \`apps/web/.env.local\`

${manualSetupBackend}

---

## Project Structure

${projectTree}

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

${backendCommands}

---

## Running Tests

${testingNotes}

---

## Environment Variables

Copy \`apps/web/.env.local.example\` to \`apps/web/.env.local\` and configure:

### App
- \`NEXT_PUBLIC_APP_URL\` - Public-facing application URL

${envVarsBackend}

${envVarsAuth}

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
| \`test.yml\` | Pull request | Runs Vitest tests${useConvex ? "" : " with PostgreSQL"} |

---

## Workflows

This project includes [Vercel Workflow DevKit](https://vercel.com/docs/workflow-kit) for durable, long-running AI workflows.

### Example Workflow

The included example workflow (\`workflows/ai-agent.ts\`) demonstrates:
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
- \`workflows/ai-agent.ts\` - Workflow definition with progress emits
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

${environmentsSection}

---

${deploymentSection}

---

## Tech Stack

${techStack}

---

## License

Private
`;
}
