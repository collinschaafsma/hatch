# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hatch is a TypeScript CLI tool that provisions exe.dev VMs for cloud-first development. It creates projects with GitHub, Vercel, and Supabase, then manages ephemeral feature VMs for isolated development environments.

## Commands

```bash
# Development - run CLI directly
pnpm dev new <project-name>                    # Create new project
pnpm dev new <project-name> --workos           # Create with WorkOS auth
pnpm dev feature <name> --project <project>    # Create feature VM
pnpm dev list                                  # List projects and VMs
pnpm dev connect                               # Show VM connection info
pnpm dev clean <name> --project <project>      # Clean up feature VM
pnpm dev config                                # Generate config file
pnpm dev add <project-name>                    # Add existing project
pnpm dev update [ssh-host]                     # Update hatch (remote or local)

# Build
pnpm build                                     # Build with tsup to dist/

# Code Quality
pnpm lint                                      # Lint with Biome
pnpm format                                    # Format with Biome
```

## Architecture

### CLI Flow
`src/index.ts` → Commander setup → Individual command files in `src/commands/`

### Commands
- **new.ts** - Create a new project via ephemeral VM
- **feature.ts** - Create feature VM with git/Supabase branches
- **add.ts** - Add existing project to tracking
- **connect.ts** - Show VM connection info
- **list.ts** - List projects and feature VMs
- **clean.ts** - Clean up feature VM and branches
- **config.ts** - Generate hatch.json config file
- **update.ts** - Update hatch CLI on a remote server or locally

### Utils
- **exe-dev.ts** - exe.dev VM management (create, delete, share port)
- **ssh.ts** - SSH/SCP wrappers for VM communication
- **spinner.ts** - Ora progress spinners with `withSpinner()` helper
- **logger.ts** - Colored console output (info, success, warn, error, step)
- **project-store.ts** - Persist project records to ~/.hatch/projects.json
- **vm-store.ts** - Persist VM records to ~/.hatch/vms.json
- **token-check.ts** - Detect stale tokens and prompt for refresh

## Generated Project Stack

When `hatch new` runs, the install script on the VM creates:
- Turborepo 2.7+ with pnpm workspaces
- Next.js 16 with React 19
- Drizzle ORM 0.45+ with PostgreSQL
- Better Auth 1.4+ (email OTP via Resend) OR WorkOS 2.13+
- Vercel AI SDK 6 with OpenAI
- Tailwind CSS 4, shadcn/ui components
- Biome for linting/formatting
- Git initialized with initial commit

## Key Files

- `src/index.ts` - CLI entry point with command registration
- `src/commands/*.ts` - Individual command implementations
- `src/types/index.ts` - HatchConfig, ProjectRecord, VMRecord interfaces
- `scripts/install.sh` - VM install script for new projects
- `scripts/feature-install.sh` - VM setup script for feature VMs
