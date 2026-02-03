---
name: hatch
description: Provision exe.dev cloud VMs for development. Use when user wants to create projects, feature branches, spike prototypes, manage VMs, or deploy to Vercel/Supabase. Triggers on "new project", "feature branch", "spike", "VM", "exe.dev", "cloud development".
compatibility: Designed for Claude Code. Requires pnpm installed locally.
metadata: {"openclaw": {"requires": {"bins": ["pnpm"]}, "emoji": "🐣"}, "author": "hatch", "version": "1.0"}
---

# Hatch - Cloud Development CLI

Hatch provisions exe.dev VMs with GitHub, Vercel, and Supabase integration.

Hatch is installed at `~/.hatch-cli`. All commands must be run from that directory using `pnpm dev`.

## Commands

### List projects and VMs
```bash
cd ~/.hatch-cli && pnpm dev list --json
```
Use first to find project names. Returns JSON with projects array and vms array.

### Create new project
```bash
cd ~/.hatch-cli && pnpm dev new <project-name>
```
Creates a new project with GitHub repo, Vercel deployment, and Supabase database.
Takes 5-10 minutes. Returns Vercel URL when complete.

### Create feature VM (interactive development)
```bash
cd ~/.hatch-cli && pnpm dev feature <name> --project <project>
```
Creates isolated VM with git/database branches. Returns SSH host and preview URL.
User will SSH in and drive development with Claude Code.

### Autonomous spike (fire and forget)
```bash
cd ~/.hatch-cli && pnpm dev spike <name> --project <project> --prompt "<instructions>"
```
Creates VM, runs Claude Agent SDK autonomously, creates PR when done.

**Options:**
- `--wait` - Block until spike completes (default: return immediately)
- `--timeout <minutes>` - Max time when using `--wait` (default: 60)
- `--json` - Output result as JSON

### Clean up
```bash
cd ~/.hatch-cli && pnpm dev clean <name> --project <project>
```
Deletes VM and branches after PR is merged.

### Add existing project
```bash
cd ~/.hatch-cli && pnpm dev add <project-name>
```
Adds an existing GitHub/Vercel/Supabase project to Hatch tracking.

### Show VM connection info
```bash
cd ~/.hatch-cli && pnpm dev connect
```
Shows SSH connection details for active VMs.

### Generate config file
```bash
cd ~/.hatch-cli && pnpm dev config
```
Generates `hatch.json` config file with credentials and defaults.

### Destroy project (DANGEROUS)
```bash
cd ~/.hatch-cli && pnpm dev destroy <project-name>
```
Permanently deletes Supabase project, Vercel project, and local tracking.
Requires typing project name to confirm. GitHub repo is preserved.
Only use after all feature VMs are cleaned.

## When to Use Feature vs Spike

### Use `feature` when:
- The task is complex or requires exploration
- The user wants to learn the codebase
- Requirements are unclear and need iteration
- Multiple back-and-forth interactions are expected
- The user explicitly asks for interactive development

### Use `spike` when:
- The task is well-defined and can be described in a prompt
- The user wants a "fire and forget" experience
- Simple features: add a form, create an API endpoint, etc.
- The user asks for something to be "spiked" or done "autonomously"
- Time is limited and the user doesn't want to SSH in

**Rule of thumb:** If you can describe the task completely in 1-2 sentences, use spike. If you need to ask clarifying questions or the task has many unknowns, use feature.

## Monitoring Spike Progress

After starting a spike, monitor with these SSH commands:

```bash
# Human-readable log (best for following along)
ssh <vm>.exe.xyz 'tail -f ~/spike.log'

# Structured progress events (JSON lines)
ssh <vm>.exe.xyz 'tail -f ~/spike-progress.jsonl'

# Check if done
ssh <vm>.exe.xyz 'test -f ~/spike-done && echo "Done" || echo "Running"'

# Get final result (includes cost)
ssh <vm>.exe.xyz 'cat ~/spike-result.json'

# Get PR URL
ssh <vm>.exe.xyz 'cat ~/pr-url.txt'
```

## Spike Output Files

The spike writes these files to the VM home directory:

| File | Description |
|------|-------------|
| `~/spike.log` | Human-readable progress log |
| `~/spike-progress.jsonl` | Structured tool use events (JSON lines) |
| `~/spike-result.json` | Final status, session ID, token usage, USD cost |
| `~/spike-done` | Marker file indicating completion |
| `~/pr-url.txt` | The created PR URL |

## Cost Tracking

Spikes track token usage and cost in `~/spike-result.json`:

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

Report costs to the user when a spike completes.

## Workflows

### Create new project
```bash
cd ~/.hatch-cli && pnpm dev new my-app
```
Share Vercel URL when complete.

### Manual feature development
```bash
# Find project name
cd ~/.hatch-cli && pnpm dev list --json

# Create feature VM
cd ~/.hatch-cli && pnpm dev feature my-feature --project my-app
```
Share SSH host so user can connect with Claude Code.

### Autonomous spike
```bash
# Find project name
cd ~/.hatch-cli && pnpm dev list --json

# Start spike
cd ~/.hatch-cli && pnpm dev spike my-feature --project my-app --prompt "Add contact form"

# Optionally monitor progress
ssh <vm>.exe.xyz 'tail -f ~/spike.log'

# Check for completion
ssh <vm>.exe.xyz 'test -f ~/spike-done && cat ~/spike-result.json'

# Clean up after PR is merged
cd ~/.hatch-cli && pnpm dev clean my-feature --project my-app
```
Share PR URL when complete.

### Blocking spike (wait for completion)
```bash
cd ~/.hatch-cli && pnpm dev spike my-feature --project my-app --prompt "Add contact form" --wait --json
```
Returns full result including PR URL and cost when done.

## Error Handling

If a spike fails:
1. Check `~/spike.log` for error details
2. The VM remains running for debugging
3. User can SSH in and fix issues manually
4. Or clean up with `cd ~/.hatch-cli && pnpm dev clean` and try again

If the spike command itself fails (before agent starts):
- The command automatically rolls back and deletes the VM
- Check error message for the cause (missing config, network issues, etc.)
