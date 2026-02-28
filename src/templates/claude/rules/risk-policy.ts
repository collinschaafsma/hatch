export function generateRiskPolicyRule(): string {
	return `---
description: Risk policy and pre-PR validation
---

## Risk Contract

The project uses a risk contract defined in \`harness.json\`. This file classifies paths by risk tier (critical, high, normal) and defines required checks.

## Pre-PR Validation

Before opening a PR, run:

\`\`\`bash
pnpm harness:pre-pr
\`\`\`

This checks:
- Risk tier of changed files
- Documentation drift (docs/ reflects current code)
- Type checking passes
- Tests pass

## Documentation

- Architecture overview: \`docs/architecture.md\`
- Coding patterns: \`docs/patterns.md\`
- Troubleshooting: \`docs/troubleshooting.md\`

Keep docs in sync with code changes. If you modify a system described in \`docs/\`, update the relevant doc file.
`;
}
