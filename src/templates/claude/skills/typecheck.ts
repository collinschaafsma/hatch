export function generateTypecheckSkill(): string {
	return `---
name: typecheck
description: Run TypeScript type checking across the Turborepo monorepo. Use when checking for type errors, validating TypeScript code, or before committing changes.
allowed-tools: Bash(pnpm:*), Read, Grep
---

# TypeScript Type Checking

## Commands

Check all packages:
\`\`\`bash
pnpm typecheck
\`\`\`

Check specific package:
\`\`\`bash
pnpm --filter web typecheck
\`\`\`

## Instructions

1. Run \`pnpm typecheck\` to check all packages
2. If errors occur, show full error output with file locations
3. Group errors by package for clarity
4. Report total error count at the end

## Common Type Patterns

### Drizzle ORM Types
- Use \`typeof schema.tableName.$inferSelect\` for select types
- Use \`typeof schema.tableName.$inferInsert\` for insert types

### Next.js App Router
- Server Components are async by default
- Client Components must have \`"use client"\` directive
- Use \`use()\` hook in client components for promises passed from server

### Workspace Packages
- Internal packages use \`@repo/\` prefix
- Path aliases: \`@/*\` maps to app root in \`apps/web\`
`;
}
