export function generateClaudeMd(name: string): string {
	return `# CLAUDE.md

> Agent-agnostic instructions live in AGENTS.md. This file adds Claude Code-specific overlays.
> Path-scoped rules are in \`.claude/rules/\`. They load automatically when you touch matching files.

## Commands

- \`pnpm dev\` — Start all apps with Turbopack
- \`pnpm build\` — Build all apps and packages
- \`pnpm lint\` — Biome linting across workspaces
- \`pnpm format\` — Biome formatting
- \`pnpm test\` — Run all tests
- \`pnpm test:ui\` — Interactive Vitest UI
- \`pnpm convex:dev\` — Start Convex development server
- \`pnpm convex:deploy\` — Deploy Convex functions to production
- \`pnpm harness:pre-pr\` — Run before opening a PR

## Documentation

- System overview: \`docs/architecture.md\`
- Coding conventions: \`docs/patterns.md\`
- Troubleshooting: \`docs/troubleshooting.md\`

## Browser Automation

Use \`agent-browser\` for web automation. Run \`agent-browser --help\` for all commands.

Core workflow:
1. \`agent-browser open <url>\` — Navigate to page
2. \`agent-browser snapshot -i\` — Get interactive elements with refs (@e1, @e2)
3. \`agent-browser click @e1\` / \`fill @e2 "text"\` — Interact using refs
4. Re-snapshot after page changes
`;
}
