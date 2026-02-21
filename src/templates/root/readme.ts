export function generateReadme(projectName: string): string {
	const prerequisites = `- [Node.js 22+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) (\`corepack enable\`)`;

	const automatedSetupDesc = `This will:
- Create a GitHub repository (or link to existing)
- Set up a Vercel project
- Create a Convex project and deploy schema
- Pull environment variables`;

	const manualSetupBackend = `3. Start the Convex dev server (in a separate terminal):
   \`\`\`bash
   pnpm convex:dev
   \`\`\`

4. Start the development server:
   \`\`\`bash
   pnpm dev
   \`\`\``;

	const projectTree = `\`\`\`
${projectName}/
├── apps/
│   └── web/              # Next.js application
│       ├── app/          # App router pages
│       ├── components/   # React components
│       ├── convex/       # Convex schema, functions, workflows, and seed
│       ├── lib/          # Utilities and auth
│       └── __tests__/    # Vitest tests
├── packages/
│   └── ui/               # Shared UI components
├── scripts/
│   └── harness/          # Evidence capture scripts
├── docs/                 # Architecture and design docs
│   └── plans/            # Execution plans from spike --plan runs
├── .github/workflows/    # CI/CD workflows
├── harness.json          # Risk contract and merge policies
├── AGENTS.md             # Agent constraints and guidelines
\`\`\``;

	const backendCommands = `## Convex Commands

| Command | Description |
|---------|-------------|
| \`pnpm convex:dev\` | Start Convex development server (auto-syncs schema) |
| \`pnpm convex:deploy\` | Deploy Convex functions to production |`;

	const testingNotes = `Tests use Vitest. Convex functions can be tested using the Convex test utilities.

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

	const envVarsBackend = `### Convex
- \`NEXT_PUBLIC_CONVEX_URL\` - Convex deployment URL (set by \`npx convex dev\`)
- \`NEXT_PUBLIC_CONVEX_SITE_URL\` - Convex HTTP actions URL (e.g. \`https://adjective-animal-123.convex.site\`)
- \`CONVEX_DEPLOY_KEY\` - Deploy key for production deployments (Vercel env var)`;

	const envVarsAuth = `### Authentication
Better Auth (runs inside Convex):
- \`BETTER_AUTH_SECRET\` - Auth encryption secret (set as Convex env var)
- \`SITE_URL\` - App URL for auth callbacks (set as Convex env var)
- \`BETTER_AUTH_URL\` - Auth callback URL`;

	const environmentsSection = `## Backend Environments

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
   - **Preview**: Unsets \`VERCEL\` and \`VERCEL_ENV\` before running \`npx convex deploy\` so the Convex CLI accepts the feature project's production deploy key in a non-production Vercel environment. The Next.js build runs separately afterward.

3. **Auth URL resolution** — The auth client uses \`window.location.origin\` in the browser so auth requests always target the current deployment's origin. This avoids CORS mismatches between preview URLs. The Convex backend's Better Auth config includes \`trustedOrigins\` with \`*.vercel.app\` and \`*.exe.xyz\` wildcards to accept requests from any preview or VM origin.

4. **Cleanup** — \`hatch clean\` removes the per-branch Vercel env vars and deletes the feature Convex project.

The \`CONVEX_DEPLOY_KEY\` env var in Vercel authorizes the deployment.`;

	const deploymentSection = `## Deployment

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

Convex functions deploy automatically during the build via \`vercel.json\`. See [Preview Deployments](#preview-deployments) above for how preview builds are handled.`;

	const techStack = `- **Framework:** [Next.js 16](https://nextjs.org/) with React 19
- **Backend:** [Convex](https://www.convex.dev/) (real-time database + serverless functions)
- **Auth:** [Better Auth](https://www.better-auth.com/) via [@convex-dev/better-auth](https://github.com/get-convex/convex-better-auth)
- **AI:** [Vercel AI SDK](https://sdk.vercel.ai/) with OpenAI
- **Workflows:** [Convex Workflows](https://github.com/get-convex/workflow) (\`@convex-dev/workflow\`)
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

Run the interactive setup script to configure GitHub, Vercel, and Convex:

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
| \`test.yml\` | Pull request | Runs Vitest tests |

---

## Agent Harness

This project includes an agent harness that provides risk-aware merge policies, documentation drift detection, and browser evidence capture. The harness is defined in \`harness.json\` at the project root.

### Harness Scripts

| Script | Description |
|--------|-------------|
| \`pnpm harness:risk-tier\` | Compute risk tier of current changes |
| \`pnpm harness:risk-tier --json\` | Machine-readable risk tier output |
| \`pnpm harness:docs-drift\` | Check if docs need updating |
| \`pnpm harness:pre-pr\` | Full pre-PR validation (build + lint + typecheck + test + risk) |
| \`pnpm harness:ui:capture-browser-evidence\` | Screenshot changed UI routes via agent-browser |
| \`pnpm harness:ui:verify-browser-evidence\` | Verify screenshots exist for changed UI files |

### Risk Tiers

Changes are classified by the files they touch:

| Tier | Files | Merge Policy |
|------|-------|--------------|
| **High** | Schema, auth, security config | Human review required + all checks pass |
| **Medium** | API routes, Convex functions | Auto-merge with all checks passing |
| **Low** | Everything else | Checks pass |

### Evidence Capture

The browser evidence scripts capture screenshots of changed UI routes:

1. Start the dev server (\`pnpm dev\`)
2. Run \`pnpm harness:ui:capture-browser-evidence\`
3. Screenshots are saved to \`.harness/evidence/\` (gitignored)
4. Set \`DEV_URL\` environment variable to override the default localhost URL

### Branch Protection

Branch protection is auto-applied during project setup. By default, admins can bypass (suitable for solo development). Use \`hatch harden --strict\` to enforce on admins too (recommended for teams).

### Testing the Harness

1. **Check risk tier:**
   \`\`\`bash
   pnpm harness:risk-tier
   \`\`\`

2. **Make a high-risk change and re-check:**
   \`\`\`bash
   # Edit apps/web/convex/schema.ts, then:
   pnpm harness:risk-tier           # Should show "high"
   \`\`\`

3. **Check documentation drift:**
   \`\`\`bash
   pnpm harness:docs-drift
   \`\`\`

4. **Run full pre-PR validation:**
   \`\`\`bash
   pnpm harness:pre-pr
   \`\`\`

5. **Test browser evidence capture:**
   \`\`\`bash
   pnpm harness:ui:capture-browser-evidence
   pnpm harness:ui:verify-browser-evidence
   \`\`\`

---

## Workflows

This project uses [Convex Workflows](https://github.com/get-convex/workflow) (\`@convex-dev/workflow\`) for durable, multi-step operations.

### Example Workflow

The included example workflow (\`convex/workflows.ts\`) demonstrates:
- Multi-step AI processing with OpenAI via Vercel AI SDK
- Reactive progress tracking via \`useQuery\`
- Durable execution with automatic retries

### How It Works

\`\`\`
Button click → useMutation(startRun) → Convex workflow → step mutations → useQuery(getRun) reactively updates UI
\`\`\`

Key files:
- \`convex/workflows.ts\` - Workflow definition, mutations, and queries
- \`app/(app)/dashboard/_components/ai-trigger.tsx\` - UI component with reactive progress

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
