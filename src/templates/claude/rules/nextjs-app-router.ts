export function generateNextjsAppRouterRule(): string {
	return `---
description: Next.js App Router conventions and patterns
globs:
  - apps/web/app/**
  - apps/web/components/**
---

## App Router Structure

- Route groups use parentheses: \`(auth)\`, \`(app)\`, \`(marketing)\`.
- Co-located components go in \`_components/\` directories within route groups.
- Shared components live in \`apps/web/components/\`.
- UI primitives from shadcn/ui are in \`apps/web/components/ui/\`.

## Server vs Client Components

- Components are Server Components by default — no directive needed.
- Add \`"use client"\` only when using hooks, event handlers, or browser APIs.
- Use the \`use()\` hook in client components to unwrap promises passed from server components.
- Keep data fetching in server components; pass data down as props.

## Import Conventions

- Use \`@/\` path alias for imports within \`apps/web\` (maps to app root).
- Example: \`import { Button } from "@/components/ui/button"\`

## UI Evidence

When building or modifying UI, capture visual evidence with \`agent-browser\`:
1. \`agent-browser open http://localhost:3000/<route>\`
2. \`agent-browser snapshot -i\` to verify the rendered output
`;
}
