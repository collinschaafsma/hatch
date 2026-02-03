# Hatch

A CLI tool that scaffolds production-ready Turborepo monorepos with Next.js, authentication, database, AI, and more.

**Cloud-first development.** Hatch provisions exe.dev VMs with everything pre-configured—CLIs authenticated, database connected, and Claude Code ready to go. VMs are ephemeral workspaces; projects are the durable artifact.

**Complete automation.** One command creates your GitHub repo, Supabase database, and Vercel deployment. Each feature gets its own VM and database branch for true isolation.

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
pnpm dev config
```

This creates `~/.hatch.json` with tokens extracted from your logged-in CLIs.

### 2. Create a Project

```bash
pnpm dev new my-app
```

This provisions a temporary exe.dev VM, sets up a complete project (GitHub, Vercel, Supabase), then deletes the VM. The project details are saved locally.

### 3. Start Feature Work

Create a feature VM with its own git branch and database branches:

```bash
pnpm dev feature add-auth --project my-app
```

This:
- Creates a new exe.dev VM
- Clones your repo and installs dependencies
- Creates a git branch
- Creates Supabase database branches (feature + test)
- Saves VM info for easy access

### 4. Connect and Build

```bash
ssh <vm-name>              # Direct SSH
code --remote ssh-remote+<vm-name> ~/my-app  # VS Code
```

Start Claude Code and begin building:

```bash
cd my-app
pnpm dev                   # Start the dev server
```

Access your app at `https://<vm-name>.exe.xyz` once the dev server is running on port 3000.

Or use Claude Code to drive development:

```bash
cd my-app
claude
```

### 5. Clean Up

When done with a feature, delete the VM and Supabase branches:

```bash
pnpm dev clean add-auth --project my-app
```

The project (GitHub, Vercel, Supabase) is preserved—only the VM and feature branches are deleted.

## Workflow Concepts

### Projects vs VMs

| Concept | Lifecycle | Contains |
|---------|-----------|----------|
| **Project** | Permanent | GitHub repo, Vercel project, Supabase project |
| **Feature VM** | Ephemeral | VM, git branch, Supabase feature branches |

Projects are created once and persist. Feature VMs are spun up for each piece of work and deleted when done.

### Parallel Development

Run Claude Code on multiple VMs simultaneously, each with complete isolation:

```
VM: peaceful-duckling → branch: add-auth → https://peaceful-duckling.exe.xyz
VM: fortune-sprite   → branch: payments → https://fortune-sprite.exe.xyz
```

Each VM has its own git branch, database branches, and public web URL. No conflicts, no shared state.

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

Running `hatch config` creates `~/.hatch.json` containing:

- **GitHub token** - From `gh` CLI config
- **Vercel token** - From `vercel` CLI config
- **Supabase token** - From `supabase` CLI config
- **Claude Code credentials** - OAuth tokens from macOS Keychain

This file is copied to VMs during setup so all CLIs authenticate automatically.

### Custom Environment Variables

You can add custom environment variables (like `RESEND_API_KEY`, `OPENAI_API_KEY`, or Vercel AI gateway vars) during `hatch config`. These get stored in `~/.hatch.json` and are automatically added to Vercel during project setup.

When running `hatch config`, you'll be prompted:

```
? Would you like to add custom environment variables? Yes
? Environment variable name: RESEND_API_KEY
? Value for RESEND_API_KEY: ********
? Which environments should this variable be set in?
  ◉ Production
  ◉ Preview
  ◉ Development
✔ Added RESEND_API_KEY
? Add another environment variable? No
```

The variables are stored in `hatch.json`:

```json
{
  "github": { ... },
  "vercel": { ... },
  "supabase": { ... },
  "envVars": [
    {
      "key": "RESEND_API_KEY",
      "value": "re_...",
      "environments": ["production", "preview", "development"]
    }
  ]
}
```

During `hatch new` or feature VM setup, these variables are automatically added to your Vercel project and pulled to `.env.local` via `vercel env pull`.

### What `hatch new` Does

1. **Provisions temp VM** - Creates an exe.dev VM
2. **Copies config** - Transfers `~/.hatch.json` to the VM
3. **Runs install script** - Sets up the complete environment and creates project
4. **Captures results** - Gets GitHub/Vercel/Supabase details from headless output
5. **Deletes VM** - The VM is ephemeral, removed after setup
6. **Saves project** - Stores project info in `~/.hatch/projects.json`

### What `hatch feature` Does

1. **Looks up project** - Gets GitHub URL from `~/.hatch/projects.json`
2. **Creates new VM** - Provisions exe.dev VM for this feature
3. **Configures web preview** - Forwards port 3000 to `https://{vm-name}.exe.xyz`
4. **Sets up environment** - Installs CLIs, authenticates, clones repo
5. **Creates branches** - Git branch + Supabase database branches
6. **Configures app URLs** - Sets `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` for the VM
7. **Saves VM info** - Stores in `~/.hatch/vms.json` for easy access

### Adding Existing Projects

Have a project already set up? Add it to Hatch to use feature VMs:

```bash
pnpm dev add my-existing-app
```

This looks up your GitHub, Vercel, and Supabase resources by project name and saves them for tracking. Then use `hatch feature` to create isolated development environments.

### Database Isolation

Supabase branching provides isolated databases for each environment:

| Environment | Database | Purpose |
|-------------|----------|---------|
| Production | Main Supabase project | Live application |
| Feature | `feature-name` branch | Isolated per-feature |
| Tests | `feature-name-test` branch | Test isolation |

## CLI Reference

### Configuration

| Command | Description |
|---------|-------------|
| `hatch config` | Create ~/.hatch.json (default) |
| `hatch config -o <path>` | Create config at custom path |
| `hatch config --refresh` | Refresh tokens without re-prompting for orgs/teams |
| `hatch config check` | Validate tokens are still valid |
| `hatch config check --json` | Validate tokens and output as JSON |

The config command prompts to add custom environment variables that will be automatically set in Vercel during project setup.

**Stale Token Detection:** When running `hatch new` or `hatch feature`, Hatch automatically checks if your CLI tokens have changed since you last ran `hatch config`. If stale tokens are detected, you'll be prompted to refresh them before proceeding.

### Project Management

| Command | Description |
|---------|-------------|
| `hatch new <project>` | Create new project (ephemeral VM setup) |
| `hatch add <project>` | Add existing project to track for feature VMs |
| `hatch list --projects` | List all projects |

### Feature VM Management

| Command | Description |
|---------|-------------|
| `hatch feature <name> --project <project>` | Create feature VM with branches |
| `hatch spike <name> --project <project> --prompt "<instructions>"` | Create VM and run Claude Agent SDK autonomously |
| `hatch connect [feature] --project <project>` | Show connection info |
| `hatch list` | List projects with feature VMs |
| `hatch clean <feature> --project <project>` | Delete feature VM and branches |

### Options

| Flag | Description |
|------|-------------|
| `--workos` | Use WorkOS instead of Better Auth |
| `--project <name>` | Specify project name |
| `--force` | Skip confirmation for clean command |
| `--json` | Output as JSON |

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
pnpm dev new my-app --workos
```

## GitHub Actions

The generated project includes:

| Workflow | Description |
|----------|-------------|
| `checks.yml` | Lint and typecheck on PRs |
| `test.yml` | Run tests with PostgreSQL |
| `claude-code-review.yml` | AI-powered code review |
| `claude.yml` | Interactive Claude via `@claude` mentions |

## Claude Code Skills

Generated projects come with pre-installed [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills) that enhance AI-assisted development. These are committed to the repo and available on all VMs.

| Skill | Description |
|-------|-------------|
| `vercel-react-best-practices` | React/Next.js performance patterns from Vercel |
| `web-design-guidelines` | UI/UX design principles |
| `vercel-composition-patterns` | Component composition patterns |
| `find-skills` | Discover and install additional skills |
| `better-auth-best-practices` | Better Auth implementation guidance |
| `frontend-design` | Frontend design principles |
| `ai-sdk` | Vercel AI SDK usage patterns |
| `agentation` | Agent-based development patterns |
| `next-cache-components` | Next.js caching strategies |
| `next-best-practices` | Next.js application patterns |
| `agent-browser` | Browser automation for testing |

Skills are installed from public GitHub repos during project creation. Use `/skills` in Claude Code to see available skills or `/find-skills` to discover more.

---

## OpenClaw Integration

Hatch can be used with [OpenClaw](https://openclaw.ai) to let your AI assistant manage development environments.

### Setup on your OpenClaw server

1. **Install hatch** on the machine running OpenClaw Gateway:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/collinschaafsma/hatch/main/scripts/master-install.sh | bash
   ```

2. **Transfer your config** from your local machine:
   ```bash
   # On your local machine (after running `hatch config`)
   scp ~/.hatch.json user@openclaw-server:~/.hatch.json
   ```

3. **Install the hatch skill**:
   ```bash
   # On your OpenClaw server
   mkdir -p ~/.openclaw/workspace/skills
   cp -r ~/.hatch-cli/skills/hatch ~/.openclaw/workspace/skills/
   ```

4. **Refresh skills** - Tell your OpenClaw assistant to "refresh skills"

### Usage

Now you can tell your assistant things like:
- "Create a new hatch project called my-app"
- "Add a contact form feature to my-app"
- "Spike a user settings page for my-app and submit a PR"

### Autonomous Spike Command

The `hatch spike` command creates a feature VM and runs the Claude Agent SDK autonomously:

```bash
hatch spike my-feature --project my-app --prompt "Add a contact form with email validation"
```

This will:
1. Create a feature VM with git/database branches
2. Start the Claude Agent SDK with your instructions
3. Return monitoring commands to check progress
4. Claude will implement the feature, commit, and create a PR

Monitor progress with the returned commands:
```bash
# Tail the log
ssh <vm-name>.exe.xyz 'tail -f ~/spike.log'

# Tail structured progress events
ssh <vm-name>.exe.xyz 'tail -f ~/spike-progress.jsonl'

# Check if done and get result
ssh <vm-name>.exe.xyz 'test -f ~/spike-done && cat ~/spike-result.json'
```

Clean up after the PR is merged:
```bash
hatch clean my-feature --project my-app
```

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
| `pnpm dev new <name>` | Create project (ephemeral VM) |
| `pnpm dev feature <name> --project <project>` | Create feature VM |
| `pnpm dev config` | Generate config file |
| `pnpm dev add <name>` | Add existing project |
| `pnpm dev list` | List projects and VMs |
| `pnpm dev connect` | Show VM connection info |
| `pnpm dev clean <name> --project <project>` | Clean up feature VM |
| `pnpm build` | Build with tsup |
| `pnpm lint` | Lint with Biome |
| `pnpm format` | Format with Biome |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm test:ui` | Run tests with Vitest UI |

## License

MIT
