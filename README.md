# Hatch

A CLI tool that scaffolds production-ready Turborepo monorepos with Next.js, authentication, database, AI, and more.

**From zero to deployed in minutes.** Hatch generates a complete full-stack application, then `pnpm app:setup` does the rest:

- Creates your GitHub repo and pushes the initial commit
- Provisions a Supabase database with connection pooling
- Links your Vercel project with the correct root directory
- Configures environment variables across all environments
- Runs database migrations and deploys to production

**Built for AI-assisted development.** The generated project includes agent scripts that create isolated environments for Claude Code:

- `pnpm agent feature-name` spins up a git worktree with its own database branch
- `pnpm agent:sandbox feature-name` adds Docker sandbox isolation for full containment
- Claude works in isolation - no risk to your main branch or data
- `pnpm agent:clean` tears everything down when you're done

A modern stack (Next.js 16, React 19, Drizzle, Tailwind 4, shadcn/ui) with auth, AI, workflows, and testing already wired up. Skip the boilerplate and start building.

## What You Get

Hatch generates a complete full-stack monorepo with:

- **[Turborepo](https://turbo.build/repo)** - High-performance build system
- **[Next.js 16](https://nextjs.org/)** - React 19 with App Router and Turbopack
- **[Drizzle ORM](https://orm.drizzle.team/)** - Type-safe database access with PostgreSQL
- **[Better Auth](https://www.better-auth.com/)** - Email OTP authentication (or [WorkOS](https://workos.com/) for enterprise SSO)
- **[Vercel AI SDK](https://sdk.vercel.ai/)** - AI/LLM integration with OpenAI
- **[Vercel Workflows](https://useworkflow.dev/)** - Durable workflow execution
- **[Tailwind CSS 4](https://tailwindcss.com/)** + **[shadcn/ui](https://ui.shadcn.com/)** - Modern styling
- **[Vitest](https://vitest.dev/)** - Fast unit and integration testing
- **[Biome](https://biomejs.dev/)** - Lightning-fast linting and formatting
- **[PostHog](https://posthog.com/)** - Product analytics
- **GitHub Actions** - CI/CD with Claude Code integration

Plus automated setup scripts for GitHub, Vercel, and Supabase.

## Quick Start

```bash
# Clone and install
git clone https://github.com/collinschaafsma/hatch.git
cd hatch
pnpm install

# Create a new project
pnpm dev create ../my-app
```

Then follow the prompts or run `pnpm app:setup` for automated configuration.

## CLI Options

```bash
pnpm dev create [project-name] [options]
```

| Option | Description |
|--------|-------------|
| `--workos` | Use WorkOS instead of Better Auth for enterprise SSO |
| `--docker` | Use local Docker PostgreSQL instead of Supabase |
| `--no-vscode` | Skip generating VS Code configuration files |

### Examples

```bash
# Default: Better Auth + Supabase
pnpm dev create ../my-app

# Enterprise SSO with WorkOS
pnpm dev create ../my-app --workos

# Local development with Docker PostgreSQL
pnpm dev create ../my-app --docker

# WorkOS + Docker (no cloud dependencies)
pnpm dev create ../my-app --workos --docker
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
│       ├── components/       # React components
│       ├── hooks/            # Custom React hooks
│       ├── db/               # Drizzle schema and client
│       ├── lib/              # Auth, safe-action, logger, utils
│       ├── services/         # Business logic layer
│       ├── workflows/        # Vercel Workflow
│       └── __tests__/        # Vitest tests and factories
├── packages/
│   └── ui/                   # Shared shadcn/ui components
├── scripts/
│   ├── setup                 # Automated GitHub/Vercel/Supabase setup
│   ├── wts                   # Worktree setup (agent sandbox)
│   ├── wtcs                  # Worktree cleanup
│   ├── sandbox/              # Docker sandbox for Claude Code
│   └── supabase-*            # Supabase management scripts
├── .claude/                  # Claude Code configuration
│   ├── settings.local.json   # Local Claude settings
│   └── skills/               # Custom Claude skills
├── .github/workflows/        # CI/CD + Claude integration
├── supabase/                 # Supabase config (if not --docker)
├── .worktreeinclude          # Files to copy into worktrees
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
pnpm dev create ../my-app
```

### Docker (Local)

Local PostgreSQL containers for offline development:
- No cloud account required
- Faster local iteration
- Isolated test database

```bash
pnpm dev create ../my-app --docker
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
pnpm dev create ../my-app --workos
```

## Agent Scripts (Claude Code)

The generated project includes scripts for isolated feature development with Claude Code:

```bash
# Create a worktree with Claude Code running directly (default)
pnpm agent feature-branch

# Create a worktree with Claude Code in Docker sandbox
pnpm agent:sandbox feature-branch

# Clean up when done (run from inside the worktree)
pnpm agent:clean           # For worktrees created with pnpm agent
pnpm agent:clean:sandbox   # For worktrees created with pnpm agent:sandbox
```

### Examples

```bash
# Work on a new feature (Claude runs directly)
pnpm agent add-user-settings

# Work with Docker sandbox isolation
pnpm agent:sandbox add-user-settings

# Clean up (from inside the worktree)
pnpm agent:clean              # Non-sandbox
pnpm agent:clean:sandbox      # Sandbox
```

### How It Works

When you run `pnpm agent my-feature`, the script:

1. Creates a git worktree at `../my-app-my-feature` (sibling to your project)
2. Creates and checks out a new branch named `my-feature`
3. Copies files listed in `.worktreeinclude` (like `.env.local`) that aren't tracked by git
4. Sets up an isolated database (Docker containers or Supabase branch)
5. Opens an iTerm2 layout with Claude Code

The `--sandbox` variant (`pnpm agent:sandbox`) additionally:
- Builds a custom Docker sandbox image
- Creates isolated node_modules volumes
- Runs Claude Code inside the Docker sandbox container

The worktree is a full working copy of your repo on its own branch, so changes are isolated from your main development.

### The `.worktreeinclude` File

Since worktrees don't share untracked files with the main repo, the `.worktreeinclude` file lists files that should be copied into new worktrees:

```
.env.local
```

Add any untracked files your worktrees need (environment files, local configs, etc.) to this file, one path per line.

### Cleaning Up

When you run `pnpm agent:clean` from inside the worktree, it:

1. Tears down the isolated database (stops Docker containers or deletes Supabase branch)
2. Deletes the feature branch
3. Removes the worktree directory

The `pnpm agent:clean:sandbox` variant additionally:
- Stops and removes the Docker sandbox container
- Removes node_modules volumes

This fully cleans up all resources created by `pnpm agent`, returning your environment to its original state.

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



## License

MIT
