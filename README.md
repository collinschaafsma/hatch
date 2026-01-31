# Hatch

A CLI tool that scaffolds production-ready Turborepo monorepos with Next.js, authentication, database, AI, and more.

**Cloud-first development.** Hatch provisions exe.dev VMs with everything pre-configured—CLIs authenticated, database connected, and Claude Code ready to go. Spin up multiple VMs to work on features in parallel.

**Complete automation.** One command creates your GitHub repo, Supabase database, and Vercel deployment. Each feature gets its own database branch for true isolation.

A modern stack (Next.js 16, React 19, Drizzle, Tailwind 4, shadcn/ui) with auth, AI, workflows, and testing already wired up. Skip the boilerplate and start building.

## Requirements

**macOS** is required (credential extraction uses Keychain).

**Accounts:**
- [exe.dev](https://exe.dev) - Cloud VMs for development
- [Supabase Pro](https://supabase.com) - Database with branching (Pro plan required)
- [Vercel](https://vercel.com) - Deployment platform
- [GitHub](https://github.com) - Repository hosting
- [Claude Code](https://claude.ai/code) - AI coding assistant (subscription required)

**CLI tools (installed and logged in):**
- `gh` - GitHub CLI
- `vercel` - Vercel CLI
- `supabase` - Supabase CLI
- `claude` - Claude Code

**SSH key** registered with exe.dev for VM access.

## Quickstart

### 1. Configure Hatch

Clone the repo and generate your config file:

```bash
git clone https://github.com/collinschaafsma/hatch.git
cd hatch
pnpm install
pnpm dev config --global
```

This creates `~/.hatch.json` with tokens extracted from your logged-in CLIs.

### 2. Create Project on VM

```bash
pnpm dev vm new my-app
```

This provisions an exe.dev VM and sets up a complete project with GitHub, Vercel, and Supabase.

### 3. Connect and Build

The command outputs connection info. Connect via SSH or VS Code Remote:

```bash
ssh <vm-name>              # Direct SSH
code --remote ssh-remote+<vm-name> ~/my-app  # VS Code
```

Start Claude Code and begin building:

```bash
cd my-app
claude
```

### 4. Feature Work

Create isolated feature branches with their own database:

```bash
pnpm dev vm feature add-auth --vm <vm-name>
```

This creates a new branch and Supabase database branches for complete isolation.

### 5. Clean Up

When done, remove the VM and all associated resources:

```bash
pnpm dev vm clean <vm-name>
```

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

## How It Works

### The Configuration File

Running `hatch config --global` creates `~/.hatch.json` containing:

- **GitHub token** - From `gh` CLI config
- **Vercel token** - From `vercel` CLI config
- **Supabase token** - From `supabase` CLI config
- **Claude Code credentials** - OAuth tokens from macOS Keychain

This file is copied to VMs during setup so all CLIs authenticate automatically.

### What `vm new` Does

1. **Provisions VM** - Creates an exe.dev VM via `ssh exe.dev new --json`
2. **Waits for ready** - Polls until VM is SSH-accessible
3. **Copies config** - Transfers `~/.hatch.json` to the VM
4. **Runs install script** - Sets up the complete environment:
   - Installs Node.js 22, pnpm, git, jq
   - Installs gh, vercel, supabase, claude CLIs
   - Authenticates all CLIs using tokens from config
   - Sets up git user.email/name for commits
   - Writes Claude Code credentials to `~/.claude/.credentials.json`
   - Clones and builds Hatch CLI
   - Runs `hatch create` in headless mode
5. **Tracks VM** - Saves VM info to `~/.hatch/vms.json`
6. **Displays connection info** - SSH, VS Code, and web URLs

### Database Isolation

Supabase branching provides isolated databases for each environment:

| Environment | Database | Purpose |
|-------------|----------|---------|
| Production | Main Supabase project | Live application |
| Development | `dev` branch | Default local dev |
| Feature | `feature-name` branch | Isolated per-feature |
| Tests | `feature-name-test` branch | Test isolation |

### Parallel Development

Run Claude Code on multiple VMs simultaneously, each with complete isolation:

```
VM: peaceful-duckling → branch: add-auth → DB: add-auth, add-auth-test
VM: fortune-sprite   → branch: payments → DB: payments, payments-test
```

Each VM has its own git branch and database branches. No conflicts, no shared state.

## CLI Reference

### Configuration

| Command | Description |
|---------|-------------|
| `hatch config` | Create hatch.json in current directory |
| `hatch config --global` | Create ~/.hatch.json (recommended) |

### VM Management

| Command | Description |
|---------|-------------|
| `hatch vm new <project>` | Create new VM + full project setup |
| `hatch vm setup <project>` | Set up project on existing VM |
| `hatch vm feature <name>` | Create feature branch with DB isolation |
| `hatch vm connect [vm]` | Show SSH, VS Code, web URLs |
| `hatch vm list [--json]` | List all tracked VMs |
| `hatch vm clean <vm>` | Delete VM + Supabase branches |

### Options

| Flag | Description |
|------|-------------|
| `--workos` | Use WorkOS instead of Better Auth |
| `--vm <name>` | Specify VM name for feature command |
| `--force` | Skip confirmation for clean command |

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
├── scripts/                  # Supabase setup scripts
├── supabase/                 # Supabase config
├── .claude/                  # Claude Code configuration
│   ├── settings.local.json   # Local Claude settings
│   └── skills/               # Custom Claude skills
├── .github/workflows/        # CI/CD + Claude integration
├── CLAUDE.md                 # Claude Code context
└── README.md                 # Generated project documentation
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
pnpm dev vm new my-app --workos
```

## GitHub Actions

The generated project includes:

| Workflow | Description |
|----------|-------------|
| `checks.yml` | Lint and typecheck on PRs |
| `test.yml` | Run tests with PostgreSQL |
| `claude-code-review.yml` | AI-powered code review |
| `claude.yml` | Interactive Claude via `@claude` mentions |

## Advanced: Local Development

For local development without VMs, you can run `hatch create` directly:

```bash
pnpm dev create ../my-app
```

Then follow the prompts or run `pnpm app:setup` for automated GitHub/Vercel/Supabase configuration.

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
| `pnpm dev config --global` | Generate config file |
| `pnpm dev vm new <name>` | Provision VM with project |
| `pnpm build` | Build with tsup |
| `pnpm lint` | Lint with Biome |
| `pnpm format` | Format with Biome |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm test:ui` | Run tests with Vitest UI |

## License

MIT
