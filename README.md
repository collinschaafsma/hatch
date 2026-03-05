# Hatch

A CLI tool that scaffolds production-ready Turborepo monorepos with Next.js, authentication, database, AI, and more.

**Cloud-first development.** Hatch provisions exe.dev VMs with everything pre-configured—CLIs authenticated, database connected, and Claude Code ready to go. VMs are ephemeral workspaces; projects are the durable artifact.

**Complete automation.** One command creates your GitHub repo, Convex backend, and Vercel deployment. Each feature gets its own VM and isolated Convex project for true isolation.

A modern stack (Next.js 16, React 19, Tailwind 4, shadcn/ui) with auth, AI, workflows, and testing already wired up. Powered by **Convex** (real-time database + serverless functions) with **Better Auth** for authentication. Skip the boilerplate and start building.

## Quickstart (Remote Server + OpenClaw)

The primary way to use Hatch is on a remote Linux server via [OpenClaw](https://openclaw.ai). Your local machine only needs to run `pnpm dev config` and `config-push` once.

### 1. Install Hatch on your Linux server

```bash
curl -fsSL https://raw.githubusercontent.com/collinschaafsma/hatch/main/scripts/master-install.sh | bash
```

This installs Node.js, pnpm, and the hatch CLI to `~/.hatch-cli`.

### 2. Transfer config from your local machine

On your local machine (macOS), generate and push your config:

```bash
git clone https://github.com/collinschaafsma/hatch.git
cd hatch && pnpm install
pnpm dev config
pnpm dev config-push user@remote-server
```

### 3. Authenticate Claude Code (one-time)

On the remote server:

```bash
claude
```

Complete the interactive OAuth login. This only needs to be done once per server.

### 4. Install the OpenClaw skill

```bash
mkdir -p ~/.openclaw/skills
cp -r ~/.hatch-cli/skills/hatch ~/.openclaw/skills/
```

Tell your OpenClaw assistant to "refresh skills".

### 5. Verify

Tell your assistant:

- "Create a new hatch project called my-app"
- "Add a contact form feature to my-app"
- "Spike a user settings page for my-app"

### Updating

From your local machine:

```bash
pnpm dev update user@remote-server
```

Or on the server itself:

```bash
cd ~/.hatch-cli && pnpm dev update
```

## What You Can Do

| Command | Description |
|---------|-------------|
| `pnpm dev new <project>` | Scaffold a full-stack project (GitHub, Vercel, Convex) via ephemeral VM |
| `pnpm dev feature <name> --project <project>` | Create a feature VM with isolated backend for interactive development |
| `pnpm dev spike <name> --project <project> --prompt "..."` | Run Claude autonomously to implement a feature and open a PR |
| `pnpm dev add <project>` | Onboard an existing project for feature VMs and spikes |
| `pnpm dev clean <name> --project <project>` | Delete a feature VM and its isolated backend |
| `pnpm dev status` | Dashboard of VM liveness, spike progress, and PR status |

### Feature vs Spike

| Aspect | `pnpm dev feature` | `pnpm dev spike` |
|--------|-----------------|---------------|
| **Best for** | Complex features, exploration, learning | Well-defined tasks, simple features |
| **How it works** | SSH in, run `claude` interactively | Agent SDK runs autonomously |
| **Human involvement** | High—you drive the work | Low—fire and forget |
| **Output** | You create the PR manually | Automatically creates PR |
| **Monitoring** | SSH session | Tail logs, check result files |
| **Cost visibility** | N/A | Tracks tokens + USD cost |

Use `feature` when you want to explore, learn the codebase, or tackle complex multi-step work. Use `spike` for straightforward tasks where you can describe what you want in a prompt.

## Requirements

**Accounts:**
- [exe.dev](https://exe.dev) — Cloud VMs for development
- [Convex](https://www.convex.dev/) — Real-time database + serverless functions
- [Vercel](https://vercel.com) — Deployment platform
- [GitHub](https://github.com) — Repository hosting
- [Claude Code](https://claude.ai/code) — AI coding assistant (subscription required)

**CLI tools (installed and logged in on your local machine):**
- `gh` — GitHub CLI
- `vercel` — Vercel CLI
- `claude` — Claude Code

**SSH key** registered with exe.dev for VM access.

## Configuration

### Config File

Running `pnpm dev config` creates `~/.hatch.json` containing tokens from your logged-in CLIs (GitHub, Convex, Claude) and prompts for your Vercel dashboard token. This file is copied to VMs during setup so all CLIs authenticate automatically.

### Per-Project Configs

For multiple projects with different credentials:

```bash
pnpm dev config --project my-app    # Creates ~/.hatch/configs/my-app.json
```

**Config resolution order** (first match wins):
1. `--config <path>` (explicit path)
2. `--project <name>` → `~/.hatch/configs/<name>.json`
3. `./hatch.json` (current directory)
4. `~/.hatch.json` (global fallback)

Discover and validate configs:

```bash
pnpm dev config list --json              # List all project configs
pnpm dev config check --project my-app   # Validate tokens
```

### Custom Environment Variables

During `pnpm dev config`, you can add environment variables (like `RESEND_API_KEY`, `AI_GATEWAY_API_KEY`, `EMAIL_FROM`) that are automatically set in Vercel during project setup. These are stored in the `envVars` array in your config file.

**Required for production:**
- `RESEND_API_KEY` — For sending authentication emails
- `AI_GATEWAY_API_KEY` — For AI/LLM functionality
- `EMAIL_FROM` — Sender address for auth emails

## What Hatch Creates

### Generated Stack

- **[Turborepo](https://turbo.build/repo)** — High-performance build system
- **[Next.js 16](https://nextjs.org/)** — React 19 with App Router and Turbopack
- **[Convex](https://www.convex.dev/)** — Real-time database with serverless functions
- **[Better Auth](https://www.better-auth.com/)** — Email OTP authentication via `@convex-dev/better-auth`
- **[Vercel AI SDK](https://sdk.vercel.ai/)** — AI/LLM integration with OpenAI
- **[Vercel Workflows](https://useworkflow.dev/)** — Durable workflow execution
- **[Tailwind CSS 4](https://tailwindcss.com/)** + **[shadcn/ui](https://ui.shadcn.com/)** — Modern styling
- **[Vitest](https://vitest.dev/)** — Fast unit and integration testing
- **[Biome](https://biomejs.dev/)** — Lightning-fast linting and formatting
- **[PostHog](https://posthog.com/)** — Product analytics
- **GitHub Actions** — CI/CD (`checks.yml` for lint/typecheck, `test.yml` for tests)

### Claude Code Skills

Generated projects ship with pre-installed [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills):

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

### Generated Project Structure

```
my-app/
├── apps/
│   └── web/                  # Next.js application
│       ├── app/              # App Router pages
│       ├── components/       # React components
│       ├── convex/           # Convex schema, functions, and seed
│       ├── hooks/            # Custom React hooks
│       ├── lib/              # Auth, utilities
│       ├── services/         # Business logic layer
│       ├── workflows/        # Vercel Workflow
│       └── __tests__/        # Vitest tests
├── packages/
│   └── ui/                   # Shared shadcn/ui components
├── scripts/
│   └── harness/              # Evidence capture scripts
├── docs/                     # Architecture and design docs
├── .claude/                  # Claude Code configuration
├── .github/workflows/        # CI/CD
├── harness.json              # Risk contract and merge policies
├── AGENTS.md                 # Agent constraints and guidelines
├── CLAUDE.md                 # Claude Code context
└── README.md                 # Generated project documentation
```

## How It Works

### `pnpm dev new`

Provisions a temporary VM, copies your config, runs the install script to create a complete project (GitHub repo, Convex backend, Vercel deployment), captures the results, deletes the VM, and saves the project record to `~/.hatch/projects.json`.

### `pnpm dev feature`

Looks up the project, creates a new VM, forwards port 3000 to a public URL, clones the repo, creates an isolated Convex project, and configures the environment. The VM info is saved to `~/.hatch/vms.json`.

### `pnpm dev spike`

Same setup as `feature`, plus installs the Claude Agent SDK and starts an autonomous agent with your prompt. The agent implements the feature, runs tests, creates a PR, and writes result files with cost tracking.

### Adding Existing Projects

`pnpm dev add` onboards an existing project (GitHub + Vercel + Convex) by creating a branch, scaffolding the agent harness, and opening a PR. Review and merge to start using feature VMs and spikes.

```bash
pnpm dev add my-existing-app                            # Clone and scaffold
pnpm dev add my-existing-app --path ~/dev/my-existing-app  # Use existing checkout
```

### Backend Isolation

Each feature gets a fully isolated Convex backend:

| Environment | Backend | Purpose |
|-------------|---------|---------|
| Production | Main Convex project | Live application (deployed via Vercel build) |
| Development | Dev deployment | Local development (`npx convex dev`) |
| Feature | `{slug}-{feature}` project | Isolated per-feature (created/deleted via API) |

Separate Convex projects are used instead of native preview deployments because preview deploy keys can't be created programmatically via the Management API.

## CLI Reference

### Configuration

| Command | Description |
|---------|-------------|
| `pnpm dev config` | Create ~/.hatch.json (default) |
| `pnpm dev config -o <path>` | Create config at custom path |
| `pnpm dev config --project <name>` | Create per-project config at `~/.hatch/configs/<name>.json` |
| `pnpm dev config --refresh` | Refresh tokens without re-prompting for orgs/teams |
| `pnpm dev config --refresh-claude` | Refresh only Claude credentials (preserves other tokens) |
| `pnpm dev config check` | Validate tokens are still valid |
| `pnpm dev config check --json` | Validate tokens and output as JSON |
| `pnpm dev config check --project <name>` | Validate a specific project's tokens |
| `pnpm dev config list` | List all project-specific configs |
| `pnpm dev config list --json` | List configs as JSON (for automation) |
| `pnpm dev config-push <ssh-host>` | Push ~/.hatch.json to a remote server |
| `pnpm dev config-push <ssh-host> -c <path>` | Push custom config file to a remote server |
| `pnpm dev config-push <ssh-host> --project <name>` | Sync project config and record to remote |

### Project Management

| Command | Description |
|---------|-------------|
| `pnpm dev new <project>` | Create new project (ephemeral VM setup) |
| `pnpm dev add <project>` | Add existing project to track for feature VMs |
| `pnpm dev list --projects` | List all projects |

### Feature VM Management

| Command | Description |
|---------|-------------|
| `pnpm dev feature <name> --project <project>` | Create feature VM with branches |
| `pnpm dev spike <name> --project <project> --prompt "<instructions>"` | Create VM and run Claude Agent SDK autonomously |
| `pnpm dev status [--json] [--project <name>]` | Dashboard of VM liveness, spike progress, and PR status |
| `pnpm dev progress <feature> --project <project> [--json]` | Detailed spike progress with plan steps and recent logs |
| `pnpm dev connect [feature] --project <project>` | Show connection info |
| `pnpm dev list` | List projects with feature VMs |
| `pnpm dev clean <feature> --project <project>` | Delete feature VM and branches |

### Hardening

| Command | Description |
|---------|-------------|
| `pnpm dev harden` | Apply branch protection from harness.json merge policy |
| `pnpm dev harden --dry-run` | Preview protection config without applying |
| `pnpm dev harden --strict` | Enforce on admins too (team mode) |
| `pnpm dev harden --project <name>` | Look up repo from project store |
| `pnpm dev harden --branch <branch>` | Target branch (default: main) |

### Remote Management

| Command | Description |
|---------|-------------|
| `pnpm dev update <ssh-host>` | Update hatch on a remote server via SSH |
| `pnpm dev update` | Update local hatch installation (run on remote server) |
| `pnpm dev update --skip-install` | Update without reinstalling dependencies |

### Spike Options

| Flag | Description |
|------|-------------|
| `--prompt "<instructions>"` | Required. Instructions for Claude to implement |
| `--wait` | Wait for spike to complete instead of returning immediately |
| `--timeout <minutes>` | Max time in minutes when using `--wait` (default: 60) |
| `--json` | Output result as JSON (useful for automation) |

### General Options

| Flag | Description |
|------|-------------|
| `--project <name>` | Specify project name |
| `--force` | Skip confirmation for clean command |
| `--json` | Output as JSON |

## Remote Spike Monitoring

Spikes run on remote VMs, and by default you monitor them by SSHing in and tailing log files. With remote monitoring enabled, the agent-runner pushes structured events to an HTTP endpoint in real time, enabling a centralized dashboard across all your spike runs.

### Enabling Remote Monitoring

Add a `monitor` block to your hatch config (global or per-project):

```json
{
  "monitor": {
    "convexSiteUrl": "https://your-dashboard.convex.site",
    "token": "your-bearer-token"
  }
}
```

| Field | Description |
|-------|-------------|
| `convexSiteUrl` | The HTTP endpoint that receives spike events |
| `token` | Bearer token sent in the `Authorization` header |

When `monitor` is set, `pnpm dev spike` passes additional environment variables to the VM so the agent-runner knows where to push events. Without it, everything works as before—local logs only.

For the full endpoint specifications, see the [Monitor API Contract](docs/monitor-api.md).

### What Gets Pushed

**`POST /api/runs/start`** — Registers the run with project metadata. Returns a `runId`.

**`POST /api/runs/events`** — Sent periodically (every 3s or when buffer hits 20 events). Includes sequence number, event type, description, and cumulative cost.

**`POST /api/runs/complete`** — Final cost, duration, session ID, plan progress, and PR metadata.

### Spike Output Files

| File | Content |
|------|---------|
| `~/spike.log` | Human-readable progress log |
| `~/spike-progress.jsonl` | Structured tool use events (JSON lines) |
| `~/spike-result.json` | Final status, cost breakdown, session ID |
| `~/pr-url.txt` | The created PR URL |

```bash
ssh <vm>.exe.xyz 'tail -f ~/spike.log'            # Watch progress
ssh <vm>.exe.xyz 'cat ~/spike-result.json'         # Final result + cost
```

### Resilience

Remote monitoring never interferes with the spike itself:
- Unreachable endpoint at startup → monitoring silently disabled
- Failed event pushes retried; after 3 consecutive failures, monitoring disabled
- 10-second timeout per HTTP request
- Warnings logged to `spike.log`

### Environment Variables

When `config.monitor` is set, these env vars are passed to the VM:

| Variable | Source |
|----------|--------|
| `HATCH_MONITOR_URL` | `config.monitor.convexSiteUrl` |
| `HATCH_MONITOR_TOKEN` | `config.monitor.token` |
| `HATCH_VM_NAME` | VM name (e.g. `peaceful-duckling`) |
| `HATCH_SSH_HOST` | SSH host (e.g. `peaceful-duckling.exe.xyz`) |
| `HATCH_GITHUB_REPO_URL` | GitHub repo URL |
| `HATCH_GITHUB_OWNER` | GitHub org/owner |
| `HATCH_GITHUB_REPO` | GitHub repo name |
| `HATCH_VERCEL_URL` | Vercel deployment URL |
| `HATCH_CONVEX_PREVIEW_URL` | Convex preview deployment URL (if applicable) |
| `HATCH_CONVEX_PREVIEW_NAME` | Convex preview deployment name (if applicable) |

## Agent Harness

Every generated project includes an agent harness for risk-aware merge policies, documentation drift detection, browser evidence capture, and branch protection. Defined in `harness.json` at the project root.

**What's included:**
- **`harness.json`** — Risk contract defining file risk tiers and merge policies
- **`AGENTS.md`** — Constraints and guidelines for AI agents
- **`scripts/harness/`** — Evidence capture and validation scripts
- **`docs/`** — Architecture and design documentation
- **CI workflows** — Automated harness validation on PRs

### Risk Tiers

| Tier | Files | Merge Policy |
|------|-------|--------------|
| **High** | Schema, auth, security config | Human review required + all checks pass |
| **Medium** | Services, API routes | Auto-merge with all checks passing |
| **Low** | Everything else | Checks pass |

### Branch Protection

`pnpm dev new` auto-applies non-strict branch protection (requires PRs and status checks, admins can bypass). Use `pnpm dev harden --strict` for team mode.

## Local Development (macOS)

For local development without a remote server, you can run Hatch directly on macOS. **macOS is required** for this path because Claude credential extraction uses Keychain.

### Setup

```bash
git clone https://github.com/collinschaafsma/hatch.git
cd hatch
pnpm install
pnpm dev config
```

### Create and Work on Projects

```bash
pnpm dev new my-app                                # Create project
pnpm dev feature add-auth --project my-app         # Create feature VM
```

Connect to your VM:

```bash
ssh <vm-name>                                       # Direct SSH
cd my-app && claude                                 # Start Claude Code

# Or connect your IDE
code --remote ssh-remote+<vm-name> ~/my-app         # VS Code
cursor --remote ssh-remote+<vm-name> ~/my-app       # Cursor
```

Access your app at `https://<vm-name>.exe.xyz` once the dev server is running on port 3000.

### Run a Spike

```bash
pnpm dev spike fix-nav --project my-app --prompt "The mobile nav menu doesn't close after clicking a link"
ssh <vm-name>.exe.xyz 'tail -f ~/spike.log'        # Monitor progress
```

### Clean Up

```bash
pnpm dev clean add-auth --project my-app
```

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
| `pnpm dev status` | Dashboard of VM liveness, spike progress, and PR status |
| `pnpm dev progress <name> --project <project>` | Detailed spike progress with plan steps and recent logs |
| `pnpm dev list` | List projects and VMs |
| `pnpm dev connect` | Show VM connection info |
| `pnpm dev clean <name> --project <project>` | Clean up feature VM |
| `pnpm dev config-push <ssh-host>` | Push config to remote server |
| `pnpm dev update [ssh-host]` | Update hatch on remote server (or locally) |
| `pnpm build` | Build with tsup |
| `pnpm lint` | Lint with Biome |
| `pnpm format` | Format with Biome |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm test:ui` | Run tests with Vitest UI |

## License

MIT
