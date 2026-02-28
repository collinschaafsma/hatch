export function generateBiomeRule(): string {
	return `---
description: Biome formatting and linting rules
globs:
  - "**/*.ts"
  - "**/*.tsx"
---

## Formatting

- **Indent**: tabs (not spaces)
- **Quotes**: double quotes
- **Trailing commas**: all
- **Semicolons**: always

## Linting

- No non-null assertions (\`!\`) — use optional chaining (\`?.\`) or guard checks.
- No unused variables or imports.
- No explicit \`any\` types — use \`unknown\` and narrow.

## Commands

- \`pnpm lint\` — check for lint errors
- \`pnpm format\` — auto-format all files
- Run both before committing.
`;
}
