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

### Create feature VM
`hatch feature <name> --project <project>`
Creates isolated VM with git/database branches. Returns SSH host and preview URL.

### Autonomous spike (creates VM + implements feature + submits PR)
`hatch spike <name> --project <project> --prompt "<instructions>"`
Runs Claude Agent SDK autonomously. Check status with provided commands. Returns PR URL when done.

### Clean up
`hatch clean <name> --project <project>`
Deletes VM and branches after PR is merged.

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
3. Monitor with provided status commands
4. Share PR URL when complete
5. `hatch clean my-feature --project my-app` - cleanup after merge
