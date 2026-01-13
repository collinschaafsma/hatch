# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hatch is a TypeScript CLI tool that scaffolds production-ready Turborepo monorepos. It generates a full-stack setup with Next.js, authentication (Better Auth with email OTP or WorkOS), Drizzle ORM, Vercel AI SDK, and Workflow DevKit.

## Commands

```bash
# Development - run CLI directly
pnpm dev create [project-name]        # Create with Better Auth
pnpm dev create [project-name] --workos  # Create with WorkOS

# Build
pnpm build                            # Build with tsup to dist/

# Code Quality
pnpm lint                             # Lint with Biome
pnpm format                           # Format with Biome
```

## Architecture

### CLI Flow
`src/index.ts` → Commander setup → `src/commands/create.ts` orchestrates the entire project generation

### Template System
Templates live in `src/templates/` organized by feature. Each exports functions that return stringified content:

- **root/** - Monorepo configs (package.json, turbo.json, pnpm-workspace.yaml, biome.json)
- **web/** - Next.js app (package.json, next.config, layout, pages, CSS, Tailwind)
- **db/** - Drizzle ORM setup (client, schema, config)
- **auth/better-auth/** - Email OTP auth (server config, client, API handler, login/verify pages, middleware)
- **auth/workos/** - Enterprise SSO (callback route, middleware, login page)
- **ai/** - Chat API route using Vercel AI SDK
- **workflow/** - Vercel Workflow DevKit example
- **dashboard/** - Protected dashboard with AI trigger button
- **ui/** - Shared UI package structure

### Utils
- **exec.ts** - Wrappers for pnpm/git commands via execa
- **spinner.ts** - Ora progress spinners with `withSpinner()` helper
- **logger.ts** - Colored console output (info, success, warn, error, step)
- **fs.ts** - File operations via fs-extra
- **prompts.ts** - Interactive prompts with npm package name validation

## Generated Project Stack

When users run the CLI, it creates:
- Turborepo 2.7+ with pnpm workspaces
- Next.js 16 with React 19
- Drizzle ORM 0.45+ with PostgreSQL
- Better Auth 1.4+ (email OTP via Resend) OR WorkOS 2.13+
- Vercel AI SDK 6 with OpenAI
- Tailwind CSS 4, shadcn/ui components
- Biome for linting/formatting
- Git initialized with initial commit

## Key Files

- `src/commands/create.ts` - Main orchestration logic (~330 lines)
- `src/templates/index.ts` - Exports all template generators
- `src/types/index.ts` - CreateOptions and TemplateContext interfaces
