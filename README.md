# Hatch

A CLI tool that scaffolds production-ready Turborepo monorepos with Next.js, authentication, database, AI, and more.

## What You Get

Hatch generates a complete full-stack monorepo with:

- **[Turborepo](https://turbo.build/repo)** - High-performance build system
- **[Next.js 16](https://nextjs.org/)** - React 19 with App Router and Turbopack
- **[Drizzle ORM](https://orm.drizzle.team/)** - Type-safe database access with PostgreSQL
- **[Better Auth](https://www.better-auth.com/)** - Email OTP authentication (or [WorkOS](https://workos.com/) for enterprise SSO)
- **[Vercel AI SDK](https://sdk.vercel.ai/)** - AI/LLM integration with OpenAI
- **[Vercel Workflow DevKit](https://vercel.com/docs/workflow-kit)** - Durable workflow execution
- **[Tailwind CSS 4](https://tailwindcss.com/)** + **[shadcn/ui](https://ui.shadcn.com/)** - Modern styling
- **[Vitest](https://vitest.dev/)** - Fast unit and integration testing
- **[Biome](https://biomejs.dev/)** - Lightning-fast linting and formatting
- **[PostHog](https://posthog.com/)** - Product analytics
- **GitHub Actions** - CI/CD with Claude Code integration

Plus automated setup scripts for GitHub, Vercel, and Supabase.

## Quick Start

```bash
# Create a new project
pnpm dlx create-hatch my-app

# Or with npx
npx create-hatch my-app
```

Then follow the prompts or run `pnpm app:setup` for automated configuration.

## CLI Options

```bash
create-hatch [project-name] [options]
```

| Option | Description |
|--------|-------------|
| `--workos` | Use WorkOS instead of Better Auth for enterprise SSO |
| `--docker` | Use local Docker PostgreSQL instead of Supabase |
| `--no-vscode` | Skip generating VS Code configuration files |

### Examples

```bash
# Default: Better Auth + Supabase
pnpm dlx create-hatch my-app

# Enterprise SSO with WorkOS
pnpm dlx create-hatch my-app --workos

# Local development with Docker PostgreSQL
pnpm dlx create-hatch my-app --docker

# WorkOS + Docker (no cloud dependencies)
pnpm dlx create-hatch my-app --workos --docker
```

## Generated Project Structure

```
my-app/
├── apps/
│   └── web/                  # Next.js application
│       ├── app/              # App Router pages
│       │   ├── (auth)/       # Login, verify-otp, callback
│       │   ├── (marketing)/  # Landing page
│       │   ├── (app)/        # Protected dashboard
│       │   └── api/          # API routes (auth, chat, workflow)
│       ├── components/       # React components + shadcn/ui
│       ├── db/               # Drizzle schema and client
│       ├── lib/              # Auth, utils, safe-action, logger
│       ├── services/         # Business logic layer
│       ├── workflows/        # Vercel Workflow DevKit
│       ├── evals/            # LLM evaluation tests
│       └── __tests__/        # Vitest tests
├── packages/
│   └── ui/                   # Shared UI components
├── scripts/
│   ├── setup                 # Automated GitHub/Vercel/Supabase setup
│   ├── wts                   # Worktree setup (Claude Code sandbox)
│   ├── wtcs                  # Worktree cleanup
│   └── supabase-*            # Supabase management scripts
├── .github/workflows/        # CI/CD + Claude integration
├── supabase/                 # Supabase config (if not --docker)
├── docker-compose.yml        # PostgreSQL containers
├── CLAUDE.md                 # Claude Code context
└── README.md                 # Generated project documentation
```

## Database Options

### Supabase (Default)

Cloud-hosted PostgreSQL with:
- Automatic branch management for isolated development
- Connection pooling for serverless
- Built-in auth and storage (optional)

```bash
pnpm dlx create-hatch my-app
```

### Docker (Local)

Local PostgreSQL containers for offline development:
- No cloud account required
- Faster local iteration
- Isolated test database

```bash
pnpm dlx create-hatch my-app --docker
```

## Authentication Options

### Better Auth (Default)

Email OTP authentication via Resend:
- Passwordless login flow
- Session management
- User/session database tables

### WorkOS

Enterprise SSO for B2B applications:
- SAML/OIDC integration
- Organization management
- User provisioning

```bash
pnpm dlx create-hatch my-app --workos
```

## Worktree Scripts (Claude Code Sandbox)

The generated project includes scripts for isolated feature development:

```bash
# Create a worktree with isolated database and Claude sandbox
./scripts/wts feature-branch

# Clean up when done
./scripts/wtcs
```

This creates:
- Git worktree for the branch
- Isolated database (Docker containers or Supabase branches)
- iTerm2 layout with Claude Code sandbox terminal

## GitHub Actions

The generated project includes:

| Workflow | Description |
|----------|-------------|
| `checks.yml` | Lint and typecheck on PRs |
| `test.yml` | Run tests with PostgreSQL |
| `claude-code-review.yml` | AI-powered code review |
| `claude.yml` | Interactive Claude via `@claude` mentions |

---

## Development (Contributing to Hatch)

### Prerequisites

- Node.js 22+
- pnpm

### Setup

```bash
git clone https://github.com/collinschaafsma/hatch.git
cd hatch
pnpm install
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev create [name]` | Run CLI in development mode |
| `pnpm build` | Build with tsup |
| `pnpm lint` | Lint with Biome |
| `pnpm format` | Format with Biome |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm test:ui` | Run tests with Vitest UI |

### Testing a Generated Project

```bash
# Generate a test project
pnpm dev create test-project

# With options
pnpm dev create test-project --docker
pnpm dev create test-project --workos
```

### Architecture

```
src/
├── index.ts              # CLI entry point (Commander)
├── commands/
│   └── create.ts         # Main orchestration (~800 lines)
├── templates/            # All generated file templates
│   ├── root/             # package.json, turbo.json, etc.
│   ├── web/              # Next.js app files
│   ├── db/               # Drizzle setup
│   ├── auth/             # Better Auth / WorkOS
│   ├── ai/               # Chat API route
│   ├── workflow/         # Vercel Workflow DevKit
│   ├── scripts/          # Worktree scripts
│   ├── github/           # GitHub Actions
│   └── ...
├── utils/
│   ├── exec.ts           # pnpm/git command wrappers
│   ├── fs.ts             # File operations
│   ├── logger.ts         # Colored console output
│   ├── spinner.ts        # Progress spinners
│   └── prompts.ts        # Interactive prompts
└── types/
    └── index.ts          # TypeScript interfaces
```

Templates export functions that return stringified content:

```typescript
// src/templates/root/package-json.ts
export function generateRootPackageJson(projectName: string): string {
  return JSON.stringify({ name: projectName, ... }, null, 2);
}
```

---

## License

MIT
