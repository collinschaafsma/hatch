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
- \`apps/web/proxy.ts\` — Request proxy

Run \`pnpm harness:pre-pr\` before opening a pull request to validate all checks pass.

## Harness Scripts

| Script | Description |
|--------|-------------|
| \`pnpm harness:risk-tier\` | Compute the risk tier of current changes |
| \`pnpm harness:docs-drift\` | Check if docs need updating for current changes |
| \`pnpm harness:pre-pr\` | Full pre-PR validation (build + lint + typecheck + test + risk-tier) |
| \`pnpm harness:ui:capture-browser-evidence\` | Capture screenshots of changed UI routes via agent-browser |
| \`pnpm harness:ui:verify-browser-evidence\` | Verify that screenshots exist for changed UI files |
| \`pnpm harness:logs\` | Query structured app logs (last 50 entries) |
| \`pnpm harness:logs:errors\` | Show only error-level log entries |
| \`pnpm harness:logs:slow\` | Show requests slower than 200ms |
| \`pnpm harness:logs:summary\` | Aggregate stats by route |
| \`pnpm harness:logs:clear\` | Clear logs (useful before a test run) |

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
- **Structured logging**: Use \`lib/logger\` for server logging. In development, JSON logs are written to \`~/.harness/logs/app.jsonl\`. Query with \`pnpm harness:logs\`.
- **Biome**: 2 spaces for indentation, double quotes, no non-null assertions.
- **Imports**: \`@/*\` for app root, \`@workspace/ui\` for shared UI package.

## Git Safety

On feature branches, \`git commit\` and \`git push\` are encouraged — commit early and often.

Always confirm before running destructive or shared-branch git commands:
- \`git push --force\`, \`git branch -D\`, \`git reset --hard\`
- \`git merge\`, \`git rebase\`, \`git cherry-pick\` on \`main\`
- Any push to \`main\`
`;
}
