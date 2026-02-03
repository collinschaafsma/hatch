---
name: hatch
description: Provision exe.dev VMs for cloud-first development. Create projects, feature branches, and autonomous spikes.
metadata: {"openclaw": {"requires": {"bins": ["hatch"]}, "emoji": "🐣"}}
---

# Hatch - Cloud Development CLI

Hatch provisions exe.dev VMs with GitHub, Vercel, and Supabase integration.

## Commands

### List projects and VMs
`hatch list --json`
Use first to find project names. Returns JSON with projects array and vms array.

### Create new project
`hatch new <project-name>`
Creates a new project with GitHub repo, Vercel deployment, and Supabase database.
Takes 5-10 minutes. Returns Vercel URL when complete.

### Create feature VM (interactive development)
`hatch feature <name> --project <project>`
Creates isolated VM with git/database branches. Returns SSH host and preview URL.
User will SSH in and drive development with Claude Code.

### Autonomous spike (fire and forget)
`hatch spike <name> --project <project> --prompt "<instructions>"`
Creates VM, runs Claude Agent SDK autonomously, creates PR when done.

**Options:**
- `--wait` - Block until spike completes (default: return immediately)
- `--timeout <minutes>` - Max time when using `--wait` (default: 60)
- `--json` - Output result as JSON

### Clean up
`hatch clean <name> --project <project>`
Deletes VM and branches after PR is merged.

## When to Use Feature vs Spike

### Use `hatch feature` when:
- The task is complex or requires exploration
- The user wants to learn the codebase
- Requirements are unclear and need iteration
- Multiple back-and-forth interactions are expected
- The user explicitly asks for interactive development

### Use `hatch spike` when:
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
1. `hatch new my-app` - creates project (5-10 min)
2. Share Vercel URL when complete

### Manual feature development
1. `hatch list --json` - find project name
2. `hatch feature my-feature --project my-app` - create VM
3. Share SSH host so user can connect with Claude Code

### Autonomous spike
1. `hatch list --json` - find project name
2. `hatch spike my-feature --project my-app --prompt "Add contact form"` - start spike
3. Optionally monitor with: `ssh <vm>.exe.xyz 'tail -f ~/spike.log'`
4. Check for completion: `ssh <vm>.exe.xyz 'test -f ~/spike-done && cat ~/spike-result.json'`
5. Share PR URL when complete
6. `hatch clean my-feature --project my-app` - cleanup after merge

### Blocking spike (wait for completion)
```bash
hatch spike my-feature --project my-app --prompt "Add contact form" --wait --json
```
Returns full result including PR URL and cost when done.

## Error Handling

If a spike fails:
1. Check `~/spike.log` for error details
2. The VM remains running for debugging
3. User can SSH in and fix issues manually
4. Or clean up with `hatch clean` and try again

If `hatch spike` itself fails (before agent starts):
- The command automatically rolls back and deletes the VM
- Check error message for the cause (missing config, network issues, etc.)
