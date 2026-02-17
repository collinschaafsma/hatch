export function generateTestSkill(): string {
	return `---
name: test
description: Run Vitest tests in the monorepo. Use when running tests, debugging test failures, checking coverage, or before commits.
allowed-tools: Bash(pnpm:*), Read, Grep
---

# Vitest Testing

## Commands

Run all tests:
\`\`\`bash
pnpm test
\`\`\`

Run with coverage:
\`\`\`bash
pnpm test:coverage
\`\`\`

Run specific package:
\`\`\`bash
pnpm --filter web test
\`\`\`

Watch mode:
\`\`\`bash
pnpm --filter web test:watch
\`\`\`

Run specific test file:
\`\`\`bash
pnpm --filter web test -- --run path/to/test.test.ts
\`\`\`

Run tests by pattern:
\`\`\`bash
pnpm --filter web test -- --run --testNamePattern "pattern"
\`\`\`

## Instructions

1. Clarify which tests to run (all, specific package, pattern)
2. Run the appropriate command
3. Show results and any failure details
4. For failures, offer to help debug

## Convex Function Tests

Convex function tests use \`convex-test\` with an in-memory backend — no external services needed.
Tests in \`__tests__/convex/\` automatically run in the \`edge-runtime\` environment.
See \`__tests__/utils/test-db.ts\` for the shared \`createConvexTest()\` helper.

## Test Structure

- \`apps/web/__tests__/\` - Main test directory
- \`apps/web/__tests__/convex/\` - Convex function integration tests
- \`apps/web/__tests__/utils/\` - Test utilities (test-db.ts, mocks.ts)
- \`apps/web/__tests__/factories/\` - Data factories
- \`apps/web/vitest.config.mts\` - Vitest configuration
- \`apps/web/vitest.setup.ts\` - Test setup file
`;
}
