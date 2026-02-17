export function generateClaudeMd(name: string): string {
	return `# CLAUDE.md

> Agent-agnostic instructions live in AGENTS.md. This file adds Claude Code-specific overlays.

## Git Operations

**ALWAYS ask for explicit user confirmation before running any git commands that modify history or remote state**, including:
- \`git commit\`
- \`git push\`
- \`git merge\`
- \`git rebase\`
- \`git reset\`
- \`git stash\`
- \`git cherry-pick\`

This applies even in dangerous/bypass permissions mode. Never auto-approve these operations.

## Commands

### Development
- \`pnpm dev\` - Start all apps with Turbopack
- \`pnpm build\` - Build all apps and packages

### Code Quality
- \`pnpm lint\` - Biome linting across workspaces
- \`pnpm format\` - Biome formatting

### Testing
- \`pnpm test\` - Run all tests
- \`pnpm test:ui\` - Interactive Vitest UI

### Convex
- \`pnpm convex:dev\` - Start Convex development server
- \`pnpm convex:deploy\` - Deploy Convex functions to production

### Harness
- \`pnpm harness:pre-pr\` - Run before opening a PR

## Vercel Workflows

All I/O operations inside a workflow MUST be wrapped in functions marked with \`"use step"\`. The workflow engine needs this to properly track, retry, and resume operations.

\`\`\`typescript
// CORRECT - wrapped in step function
async function fetchData(id: string) {
  "use step";
  return getDataFromDb(id);
}

export async function myWorkflow(input) {
  "use workflow";
  const data = await fetchData(id);
}
\`\`\`

## Service Layer

All database access goes through service files in \`apps/web/services/\`. Never call Convex directly from components or server actions.

## Browser Automation

Use \`agent-browser\` for web automation. Run \`agent-browser --help\` for all commands.

Core workflow:
1. \`agent-browser open <url>\` - Navigate to page
2. \`agent-browser snapshot -i\` - Get interactive elements with refs (@e1, @e2)
3. \`agent-browser click @e1\` / \`fill @e2 "text"\` - Interact using refs
4. Re-snapshot after page changes
`;
}
