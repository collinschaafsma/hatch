export function generateClaudeMd(name: string): string {
	return `# CLAUDE.md

> Agent-agnostic instructions live in AGENTS.md. This file adds Claude Code-specific overlays.

## Git Safety

On feature branches, \`git commit\` and \`git push\` are encouraged — commit early and often.

Always confirm before running destructive or shared-branch git commands:
- \`git push --force\`, \`git branch -D\`, \`git reset --hard\`
- \`git merge\`, \`git rebase\`, \`git cherry-pick\` on \`main\`
- Any push to \`main\`

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

## Browser Automation

Use \`agent-browser\` for web automation. Run \`agent-browser --help\` for all commands.

Core workflow:
1. \`agent-browser open <url>\` - Navigate to page
2. \`agent-browser snapshot -i\` - Get interactive elements with refs (@e1, @e2)
3. \`agent-browser click @e1\` / \`fill @e2 "text"\` - Interact using refs
4. Re-snapshot after page changes
`;
}
