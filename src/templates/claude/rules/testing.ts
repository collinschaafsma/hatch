export function generateTestingRule(): string {
	return `---
description: Testing conventions with Vitest and convex-test
globs:
  - apps/web/__tests__/**
  - "**/*.test.ts"
  - "**/*.test.tsx"
---

## Test Framework

- Tests use **Vitest** with \`convex-test\` for Convex function testing.
- Config: \`apps/web/vitest.config.mts\`
- Setup: \`apps/web/vitest.setup.ts\`

## Running Tests

- \`pnpm test\` — run all tests
- \`pnpm test:ui\` — interactive Vitest UI
- \`pnpm --filter web test\` — run tests for the web app only

## Conventions

- Test files live in \`apps/web/__tests__/\` organized by type: \`unit/\`, \`components/\`, \`integration/\`, \`convex/\`.
- Use factories from \`__tests__/factories/\` to create test data.
- Use \`createConvexTest()\` helper from \`__tests__/utils/test-db.ts\` for Convex function tests.
- Mock external services in \`__tests__/utils/mocks.ts\`.
- Component tests use the render helper from \`__tests__/utils/render.tsx\`.

## Patterns

- Prefer \`describe\` / \`it\` blocks with clear descriptions.
- One assertion per test when possible.
- Use \`vi.mock()\` for module mocking, \`vi.fn()\` for function mocking.
`;
}
