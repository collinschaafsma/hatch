export function generateAgentsMd(name: string): string {
	return `# AGENTS.md

Agent-agnostic instructions for working with ${name}.

## Quick Start

\`\`\`bash
pnpm install        # Install dependencies
pnpm dev            # Start development server
pnpm test           # Run tests
pnpm lint           # Lint code
pnpm typecheck      # Type checking
\`\`\`

## Documentation Index

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | System overview, directory structure, data flows |
| [docs/patterns.md](docs/patterns.md) | Code conventions, component patterns, testing |
| [docs/api-contracts.md](docs/api-contracts.md) | API routes, schemas, environment variables |
| [docs/deployment.md](docs/deployment.md) | Environments, deploy process, setup steps |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common errors and fixes |
| [docs/decisions/](docs/decisions/) | Architecture Decision Records |

## Risk & Review Policy

This project uses a machine-readable risk contract at \`harness.json\`.

### High-Risk Paths (require human review)
- \`apps/web/convex/schema.ts\` — Database schema
- \`apps/web/convex/betterAuth/**\` — Authentication component
- \`apps/web/lib/auth*.ts\` — Auth configuration
- \`apps/web/app/api/auth/**\` — Auth API routes
- \`apps/web/middleware.ts\` — Request middleware

Run \`pnpm harness:pre-pr\` before opening a pull request to validate all checks pass.

## Harness Scripts

| Script | Description |
|--------|-------------|
| \`pnpm harness:risk-tier\` | Compute the risk tier of current changes |
| \`pnpm harness:docs-drift\` | Check if docs need updating for current changes |
| \`pnpm harness:pre-pr\` | Full pre-PR validation (lint + typecheck + test + risk-tier) |
| \`pnpm harness:ui:capture-browser-evidence\` | Capture screenshots of changed UI routes via agent-browser |
| \`pnpm harness:ui:verify-browser-evidence\` | Verify that screenshots exist for changed UI files |

## Evidence Capture

When UI files are changed (\`apps/web/app/**/*.tsx\`, \`packages/ui/**/*.tsx\`), capture visual evidence:

1. Start the dev server: \`pnpm dev\`
2. Run \`pnpm harness:ui:capture-browser-evidence\` — uses \`agent-browser\` to screenshot affected routes
3. Screenshots are saved to \`.harness/evidence/\` (gitignored)
4. Run \`pnpm harness:ui:verify-browser-evidence\` to check coverage

Set \`DEV_URL\` env var to override the default \`http://localhost:3000\`.

## Conventions

- **Server/client split**: Server components create promises, client components unwrap with \`use()\`. See [docs/patterns.md](docs/patterns.md).
- **Convex-native**: Use \`useQuery\`/\`useMutation\` from \`convex/react\` for data access. Workflows use \`@convex-dev/workflow\`.
- **Route groups**: \`(marketing)/\` for public, \`(auth)/\` for login, \`(app)/\` for authenticated pages.
- **Biome**: Tabs for indentation, double quotes, no non-null assertions.
- **Imports**: \`@/*\` for app root, \`@workspace/ui\` for shared UI package.

## Git Safety

Always confirm before running destructive or state-modifying git commands:
- \`git commit\`, \`git push\`, \`git merge\`, \`git rebase\`
- \`git reset\`, \`git stash\`, \`git cherry-pick\`
- \`git branch -D\`, \`git push --force\`

This applies regardless of automation level or permissions mode.
`;
}
