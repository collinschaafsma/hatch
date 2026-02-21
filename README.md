# Hatch

A CLI tool that scaffolds production-ready Turborepo monorepos with Next.js, authentication, database, AI, and more.

**Cloud-first development.** Hatch provisions exe.dev VMs with everything pre-configured—CLIs authenticated, database connected, and Claude Code ready to go. VMs are ephemeral workspaces; projects are the durable artifact.

**Complete automation.** One command creates your GitHub repo, Convex backend, and Vercel deployment. Each feature gets its own VM and isolated Convex project for true isolation.

A modern stack (Next.js 16, React 19, Tailwind 4, shadcn/ui) with auth, AI, workflows, and testing already wired up. Powered by **Convex** (real-time database + serverless functions) with **Better Auth** for authentication. Skip the boilerplate and start building.

## Why Hatch

Most AI coding tools generate throwaway prototypes. The code works in a demo but falls apart when you try to ship it: wrong versions, missing auth, no database migrations, no CI, no deployment pipeline. You end up rewriting everything to make it production-grade.

Hatch takes the opposite approach. Every project starts with a production-ready architecture that you can deploy on day one.

**Current dependencies, every time.** Next.js 16, React 19, Tailwind 4, Turborepo 2.7+. No outdated starter templates. Every `hatch new` pulls the latest stable versions so you're never starting behind.

**Real authentication.** Email OTP via Better Auth and Resend. Not a mock login screen—actual auth flows with session management and database-backed user records. Better Auth runs inside Convex as a component via `@convex-dev/better-auth`.

**Real database.** Convex provides a real-time database with serverless functions. Feature branches get their own Convex project for full isolation.

**AI and workflows built in.** Vercel AI SDK with Vercel AI Gateway, plus durable workflows with SSE streaming. Not bolted on after the fact—wired into the monorepo from the start.

**UI ready to go.** Tailwind 4 with shadcn/ui components pre-configured in a shared package. Start building interfaces immediately instead of spending time on design system setup.

**Testing and linting from the start.** Vitest configured with example tests and factories so you have working patterns to follow. Biome handles linting and formatting with zero config. CI runs both on every PR.

**Deployed to your infrastructure.** GitHub repo in your org, Vercel project on your team, backend in your organization. All environment variables, CI/CD, and preview deployments are configured automatically. Push to main and you're live.

**All env setup handled.** Hatch extracts tokens from your logged-in CLIs, copies them to VMs, authenticates every tool, and pulls environment variables into your project. No manual `.env` wrangling or secrets management.

**Loaded with Claude Code skills.** Every generated project ships with curated skills for React performance, AI SDK patterns, auth best practices, component design, and more. Claude Code is productive in your codebase from the first session.

**Isolated dev environments.** Each feature gets its own VM, git branch, and isolated Convex project. Run multiple features in parallel with zero conflicts. When you're done, `hatch clean` tears it all down.

**Built for teams.** The generated monorepo follows conventions that professional engineering teams expect: typed schemas, a services layer, proper project structure, CI checks, and preview deployments per PR. A new engineer can clone the repo and understand where things go.

**Primed for coding agents.** Every project includes a `CLAUDE.md` with full codebase context, pre-installed skills, and `hatch spike` can run Claude autonomously on its own VM to implement features and open PRs. The architecture is consistent and well-documented—exactly what agents need to be effective.

**No graduation step.** The codebase you build features in is the codebase you ship. Same stack in development and production. There's no "rewrite it properly" phase because the architecture is already proper.

## Requirements

**macOS** is required (Claude credential extraction uses Keychain).

**Accounts:**
- [exe.dev](https://exe.dev) - Cloud VMs for development
- [Convex](https://www.convex.dev/) - Real-time database + serverless functions
- [Vercel](https://vercel.com) - Deployment platform
- [GitHub](https://github.com) - Repository hosting
- [Claude Code](https://claude.ai/code) - AI coding assistant (subscription required)

**CLI tools (installed and logged in):**
- `gh` - GitHub CLI
- `vercel` - Vercel CLI
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

This creates `~/.hatch.json` with tokens from your logged-in CLIs (GitHub, Convex, Claude) and prompts you to paste your Vercel dashboard token.

### 2. Create a Project

```bash
pnpm dev new my-app
```

This provisions a temporary exe.dev VM, sets up a complete project (GitHub, Vercel, and Convex), then deletes the VM. The project details are saved locally.

### 3. Start Feature Work

You have two options for feature development:

#### Option A: Interactive with `hatch feature`

Create a feature VM and drive development yourself:

```bash
pnpm dev feature add-auth --project my-app
```

Then connect and start building:

```bash
ssh <vm-name>              # Direct SSH
cd my-app
claude                     # Start Claude Code
```

Or connect your IDE for a full development experience:

```bash
# VS Code
code --remote ssh-remote+<vm-name> ~/my-app

# Cursor
cursor --remote ssh-remote+<vm-name> ~/my-app
```

Access your app at `https://<vm-name>.exe.xyz` once the dev server is running on port 3000.

#### Option B: Autonomous with `hatch spike`

Let Claude implement the feature and create a PR automatically:

```bash
pnpm dev spike fix-nav --project my-app --prompt "The mobile nav menu doesn't close after clicking a link"
```

Monitor progress while it runs:

```bash
ssh <vm-name>.exe.xyz 'tail -f ~/spike.log'
```

When complete, you'll get a PR URL. Review it and merge.

### 4. Clean Up

When done with a feature, delete the VM and backend resources:

```bash
pnpm dev clean add-auth --project my-app
```

The project (GitHub, Vercel, and main Convex backend) is preserved—only the VM and feature-specific Convex project are deleted.

## Workflow Concepts

### Projects vs VMs

| Concept | Lifecycle | Contains |
|---------|-----------|----------|
| **Project** | Permanent | GitHub repo, Vercel project, Convex backend |
| **Feature VM** | Ephemeral | VM, git branch, isolated Convex project |

Projects are created once and persist. Feature VMs are spun up for each piece of work and deleted when done.

### Feature vs Spike

| Aspect | `hatch feature` | `hatch spike` |
|--------|-----------------|---------------|
| **Best for** | Complex features, exploration, learning | Well-defined tasks, simple features |
| **How it works** | SSH in, run `claude` interactively | Agent SDK runs autonomously |
| **Human involvement** | High—you drive the work | Low—fire and forget |
| **Output** | You create the PR manually | Automatically creates PR |
| **Monitoring** | SSH session | Tail logs, check result files |
| **Cost visibility** | N/A | Tracks tokens + USD cost |

Use `feature` when you want to explore, learn the codebase, or tackle complex multi-step work. Use `spike` for straightforward tasks where you can describe what you want in a prompt.

### Parallel Development

Run Claude Code on multiple VMs simultaneously, each with complete isolation:

```
VM: peaceful-duckling → branch: add-auth → https://peaceful-duckling.exe.xyz
VM: fortune-sprite   → branch: payments → https://fortune-sprite.exe.xyz
```

Each VM has its own git branch, isolated Convex project, and public web URL. No conflicts, no shared state.

## What You Get

Hatch generates a complete full-stack monorepo with:

- **[Turborepo](https://turbo.build/repo)** - High-performance build system
- **[Next.js 16](https://nextjs.org/)** - React 19 with App Router and Turbopack
- **[Convex](https://www.convex.dev/)** - Real-time database with serverless functions
- **[Better Auth](https://www.better-auth.com/)** - Email OTP authentication via `@convex-dev/better-auth`
- **[Vercel AI SDK](https://sdk.vercel.ai/)** - AI/LLM integration with OpenAI
- **[Vercel Workflows](https://useworkflow.dev/)** - Durable workflow execution
- **[Tailwind CSS 4](https://tailwindcss.com/)** + **[shadcn/ui](https://ui.shadcn.com/)** - Modern styling
- **[Vitest](https://vitest.dev/)** - Fast unit and integration testing
- **[Biome](https://biomejs.dev/)** - Lightning-fast linting and formatting
- **[PostHog](https://posthog.com/)** - Product analytics
- **GitHub Actions** - CI/CD

## How It Works

### The Configuration File

Running `hatch config` creates `~/.hatch.json` containing:

- **GitHub token** - From `gh` CLI config
- **Vercel token** - From Vercel dashboard token (https://vercel.com/account/settings/tokens)
- **Convex access token** - From Convex CLI config
- **Claude Code credentials** - OAuth tokens from macOS Keychain

This file is copied to VMs during setup so all CLIs authenticate automatically.

### Per-Project Configuration

For managing multiple projects with different credentials, create per-project configs:

```bash
pnpm dev config --project my-app
```

This writes to `~/.hatch/configs/my-app.json` instead of the global `~/.hatch.json`. Commands with `--project` auto-resolve the right config.

**Config resolution order** (first match wins):
1. `--config <path>` (explicit path)
2. `--project <name>` → `~/.hatch/configs/<name>.json`
3. `./hatch.json` (current directory)
4. `~/.hatch.json` (global fallback)

Discover and validate configs:

```bash
pnpm dev config list --json           # List all project configs
pnpm dev config check --project my-app --json  # Validate tokens
```

When pushing to a remote VM, `config-push` copies the resolved config to `~/.hatch.json` on the VM (each VM serves one project):

```bash
pnpm dev config-push user@remote-server --project my-app
```

### Custom Environment Variables

You can add custom environment variables (like `RESEND_API_KEY`, `AI_GATEWAY_API_KEY`, or `EMAIL_FROM`) during `hatch config`. These get stored in `~/.hatch.json` and are automatically added to Vercel during project setup.

**Required for production:** To have your production deployment work end-to-end out of the box, you'll need to set:
- `RESEND_API_KEY` - For sending authentication emails
- `AI_GATEWAY_API_KEY` - For AI/LLM functionality
- `EMAIL_FROM` - The sender address for auth emails (e.g., `noreply@yourdomain.com`)

When running `hatch config`, you'll be prompted:

```
? Would you like to add custom environment variables? Yes
? Environment variable name: AI_GATEWAY_API_KEY
? Value for AI_GATEWAY_API_KEY: ********
? Which environments should this variable be set in?
  ◉ Production
  ◉ Preview
  ◉ Development
✔ Added AI_GATEWAY_API_KEY
? Add another environment variable? Yes
? Environment variable name: EMAIL_FROM
? Value for EMAIL_FROM: noreply@example.com
...
```

The variables are stored in `hatch.json`:

```json
{
  "github": { ... },
  "vercel": { ... },
  "convex": { ... },
  "envVars": [
    {
      "key": "AI_GATEWAY_API_KEY",
      "value": "sk-...",
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
4. **Captures results** - Gets GitHub/Vercel/backend details from headless output
5. **Deletes VM** - The VM is ephemeral, removed after setup
6. **Saves project** - Stores project info in `~/.hatch/projects.json`

The install script creates a Convex project, deploys the schema, and sets up Better Auth inside Convex.

### What `hatch feature` Does

1. **Looks up project** - Gets GitHub URL from `~/.hatch/projects.json`
2. **Creates new VM** - Provisions exe.dev VM for this feature
3. **Configures web preview** - Forwards port 3000 to `https://{vm-name}.exe.xyz`
4. **Sets up environment** - Installs CLIs, authenticates, clones repo
5. **Creates isolated backend** - Separate Convex project via API + deploy
6. **Configures app URLs** - Sets `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` for the VM
7. **Saves VM info** - Stores in `~/.hatch/vms.json` for easy access

### What `hatch spike` Does

1. **Same setup as feature** - VM, isolated backend, environment (steps 1-7 above)
2. **Installs Claude Agent SDK** - Adds `@anthropic-ai/claude-agent-sdk` to the project
3. **Starts agent with your prompt** - Runs autonomously in background
4. **Agent implements the feature** - Writes code, runs tests, commits changes
5. **Creates PR automatically** - Pushes branch and opens pull request
6. **Writes result files** - Cost tracking and status information

**Output files on the VM:**
- `~/spike.log` - Human-readable progress log
- `~/spike-progress.jsonl` - Structured tool use events (JSON lines)
- `~/spike-result.json` - Final status, cost breakdown, session ID
- `~/pr-url.txt` - The created PR URL

**Monitoring commands:**
```bash
ssh <vm>.exe.xyz 'tail -f ~/spike.log'            # Watch progress
ssh <vm>.exe.xyz 'tail -f ~/spike-progress.jsonl' # Structured events
ssh <vm>.exe.xyz 'cat ~/spike-result.json'        # Final result + cost
ssh <vm>.exe.xyz 'cat ~/pr-url.txt'               # Get PR URL
```

**Cost tracking:** The result file includes token usage and USD cost:
```json
{
  "status": "completed",
  "sessionId": "session_abc123",
  "cost": {
    "inputTokens": 45000,
    "outputTokens": 12000,
    "totalUsd": 0.0234
  }
}
```

### Adding Existing Projects

Have a project already set up? Add it to Hatch to use feature VMs:

```bash
pnpm dev add my-existing-app
```

This looks up your GitHub, Vercel, and Convex resources by project name and saves them for tracking. Then use `hatch feature` to create isolated development environments.

### Backend Isolation

Each feature gets a fully isolated Convex backend. Separate projects provide full isolation:

| Environment | Backend | Purpose |
|-------------|---------|---------|
| Production | Main Convex project | Live application (deployed via Vercel build) |
| Development | Dev deployment | Local development (`npx convex dev`) |
| Feature | `{slug}-{feature}` project | Isolated per-feature (created/deleted via API) |

### Why Separate Convex Projects for Features

Convex has native [preview deployments](https://docs.convex.dev/production/hosting/preview-deployments) for branch-level isolation, but they require a preview deploy key that can only be generated manually from the Convex Dashboard—there's no Management API support for creating them programmatically. Since Hatch requires full automation (no manual steps), we create a separate Convex project per feature branch instead. When Convex adds API support for preview deploy keys, we can migrate to native preview deployments.

## CLI Reference

### Configuration

| Command | Description |
|---------|-------------|
| `hatch config` | Create ~/.hatch.json (default) |
| `hatch config -o <path>` | Create config at custom path |
| `hatch config --project <name>` | Create per-project config at `~/.hatch/configs/<name>.json` |
| `hatch config --refresh` | Refresh tokens without re-prompting for orgs/teams |
| `hatch config --refresh-claude` | Refresh only Claude credentials (preserves other tokens) |
| `hatch config check` | Validate tokens are still valid |
| `hatch config check --json` | Validate tokens and output as JSON |
| `hatch config check --project <name>` | Validate a specific project's tokens |
| `hatch config list` | List all project-specific configs |
| `hatch config list --json` | List configs as JSON (for automation) |
| `hatch config-push <ssh-host>` | Push ~/.hatch.json to a remote server |
| `hatch config-push <ssh-host> -c <path>` | Push custom config file to a remote server |
| `hatch config-push <ssh-host> --project <name>` | Push project-specific config to remote |

The config command prompts to add custom environment variables that will be automatically set in Vercel during project setup.

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
| `hatch status [--json] [--project <name>]` | Dashboard of VM liveness, spike progress, and PR status |
| `hatch progress <feature> --project <project> [--json]` | Detailed spike progress with plan steps and recent logs |
| `hatch connect [feature] --project <project>` | Show connection info |
| `hatch list` | List projects with feature VMs |
| `hatch clean <feature> --project <project>` | Delete feature VM and branches |

### Hardening

| Command | Description |
|---------|-------------|
| `hatch harden` | Apply branch protection from harness.json merge policy |
| `hatch harden --dry-run` | Preview protection config without applying |
| `hatch harden --strict` | Enforce on admins too (team mode) |
| `hatch harden --project <name>` | Look up repo from project store |
| `hatch harden --branch <branch>` | Target branch (default: main) |

### Remote Management

| Command | Description |
|---------|-------------|
| `hatch update <ssh-host>` | Update hatch on a remote server via SSH |
| `hatch update` | Update local hatch installation (run on remote server) |
| `hatch update --skip-install` | Update without reinstalling dependencies |

### Spike Options

| Flag | Description |
|------|-------------|
| `--prompt "<instructions>"` | Required. Instructions for Claude to implement |
| `--plan` | Create an execution plan before coding (for complex features) |
| `--wait` | Wait for spike to complete instead of returning immediately |
| `--timeout <minutes>` | Max time in minutes when using `--wait` (default: 60) |
| `--json` | Output result as JSON (useful for automation) |

### General Options

| Flag | Description |
|------|-------------|
| `--project <name>` | Specify project name |
| `--force` | Skip confirmation for clean command |
| `--json` | Output as JSON |

## Generated Project Structure

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

## Authentication

Better Auth provides email OTP authentication via Resend:
- Passwordless login flow
- Session management
- User/session database tables

Better Auth runs inside Convex as a component via `@convex-dev/better-auth`. Next.js proxies auth requests to Convex's HTTP actions endpoint.

## GitHub Actions

The generated project includes:

| Workflow | Description |
|----------|-------------|
| `checks.yml` | Lint and typecheck on PRs |
| `test.yml` | Run tests |

## Agent Harness

Every generated project includes an agent harness that provides risk-aware merge policies, documentation drift detection, browser evidence capture, and branch protection. The harness is defined in `harness.json` at the project root and enforced via scripts and CI workflows.

### What's Included

- **`harness.json`** — Risk contract defining which files are high/medium/low risk and the corresponding merge policies
- **`AGENTS.md`** — Constraints and guidelines for AI agents working in the codebase
- **`scripts/harness/`** — Evidence capture and validation scripts
- **`docs/`** — Architecture and design documentation
- **CI workflows** — Automated checks that run harness validation on PRs

### Risk Tiers

Changes are classified by the files they touch:

| Tier | Files | Merge Policy |
|------|-------|--------------|
| **High** | Schema, auth, security config | Human review required + all checks pass |
| **Medium** | Services, API routes | Auto-merge with all checks passing |
| **Low** | Everything else | Checks pass |

### Auto-Hardening

When `hatch new` creates a project, it automatically applies non-strict branch protection to the `main` branch after creating the GitHub repo. This requires PR reviews and status checks but allows admins to bypass (suitable for solo development). Use `hatch harden --strict` to enforce on admins too (recommended for teams).

### Manual Hardening

Use `hatch harden` to apply or update branch protection at any time:

```bash
hatch harden                    # Apply from harness.json
hatch harden --dry-run          # Preview without applying
hatch harden --strict           # Enforce on admins (team mode)
hatch harden --project my-app   # Look up repo from project store
```

### Testing the Harness

Test the full harness flow using a VM-based workflow:

1. **Create a project with the harness:**
   ```bash
   pnpm dev new test-harness
   ```

2. **SSH into the VM and verify files exist:**
   ```bash
   ls harness.json AGENTS.md scripts/harness/ docs/
   ```

3. **Check risk tier (no changes = low):**
   ```bash
   pnpm harness:risk-tier
   pnpm harness:risk-tier --json    # Machine-readable output
   ```

4. **Make a high-risk change and re-check:**
   ```bash
   # Edit a schema or auth file, then:
   pnpm harness:risk-tier           # Should show "high"
   ```

5. **Check documentation drift:**
   ```bash
   pnpm harness:docs-drift
   ```

6. **Run full pre-PR validation:**
   ```bash
   pnpm harness:pre-pr
   ```

7. **Test browser evidence capture (graceful fallback without agent-browser):**
   ```bash
   pnpm harness:ui:capture-browser-evidence
   pnpm harness:ui:verify-browser-evidence
   ```

8. **Verify branch protection was auto-applied:**
   ```bash
   gh api /repos/{owner}/{repo}/branches/main/protection
   ```

9. **Preview and upgrade protection:**
   ```bash
   hatch harden --dry-run           # Preview current config
   hatch harden --strict            # Upgrade to team mode
   ```

10. **Clean up:**
    ```bash
    pnpm dev clean test-harness --project test-harness
    ```

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

## Remote Server Installation

Hatch can be installed on any Linux server (not just macOS) for automation or AI-assisted workflows.

### Install on a Remote Server

1. **Install hatch CLI**:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/collinschaafsma/hatch/main/scripts/master-install.sh | bash
   ```

   This installs Node.js, pnpm, and the hatch CLI to `~/.hatch-cli`.

2. **Transfer your config** from your local machine:
   ```bash
   # On your local machine (after running `hatch config`)
   pnpm dev config-push user@remote-server

   # Or push a specific project's config
   pnpm dev config-push user@remote-server --project my-app
   ```

3. **Authenticate Claude Code** on the remote server:
   ```bash
   claude
   ```

   Complete the interactive OAuth login. This creates `~/.claude/.credentials.json` which hatch uses for Claude token refresh. You only need to do this once per server.

4. **Verify installation**:
   ```bash
   cd ~/.hatch-cli
   pnpm dev list --json
   ```

### OpenClaw Integration

For [OpenClaw](https://openclaw.ai) users, install the hatch skill:

```bash
mkdir -p ~/.openclaw/skills
cp -r ~/.hatch-cli/skills/hatch ~/.openclaw/skills/
```

Then tell your OpenClaw assistant to "refresh skills".

### Update on a Remote Server

From your local machine, update hatch on a remote server:

```bash
pnpm dev update user@remote-server
```

Or update locally on the server itself:

```bash
cd ~/.hatch-cli && pnpm dev update
```

This pulls the latest code, reinstalls dependencies, rebuilds, and updates the OpenClaw skill if installed.

Now you can tell your assistant things like:
- "Create a new hatch project called my-app"
- "Add a contact form feature to my-app"
- "Spike a user settings page for my-app"

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
