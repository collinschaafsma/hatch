export function generateDocsPatterns(): string {
	return `# Patterns and Conventions

## Server/Client Component Split

Create promises in server components but do NOT await them. Pass the promises to client components wrapped in Suspense. Client components unwrap with React's \`use()\` hook.

\`\`\`tsx
// Server component
export default function Page() {
  const dataPromise = getItems(); // do NOT await
  return (
    <Suspense fallback={<Loading />}>
      <ItemList dataPromise={dataPromise} />
    </Suspense>
  );
}

// Client component
"use client";
import { use } from "react";

export function ItemList({ dataPromise }: { dataPromise: Promise<Item[]> }) {
  const items = use(dataPromise);
  return <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
}
\`\`\`

## Route Groups

- \`(marketing)/\` — Public pages (landing, pricing, etc.)
- \`(auth)/\` — Login and authentication flows
- \`(app)/\` — Authenticated pages, protected by middleware

## Services Layer

All database access goes through \`services/\` files. Components and server actions never call Convex queries or mutations directly. This keeps data access testable and centralized.

\`\`\`typescript
// services/items.ts
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function getItems() {
  return fetchQuery(api.items.list);
}
\`\`\`

## Safe Actions with Zod Validation

Use \`next-safe-action\` for server actions with Zod schema validation. This provides type-safe inputs and structured error handling.

\`\`\`typescript
import { actionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
});

export const createItem = actionClient
  .schema(schema)
  .action(async ({ parsedInput }) => {
    // parsedInput is typed and validated
  });
\`\`\`

## Convex Conventions

- **Queries** for reads — reactive by default, automatically re-run when data changes
- **Mutations** for writes — transactional, run in the Convex database
- **Actions** for side effects — calling external APIs, sending emails, etc.

## Biome Rules

- Tabs for indentation (not spaces)
- Double quotes for strings
- No non-null assertions (\`!.\`) — use optional chaining (\`?.\`) or guard checks instead
- Trailing commas in multi-line structures

## Import Structure

- \`@/*\` — App root imports (e.g., \`@/components/header\`, \`@/services/items\`)
- \`@workspace/ui\` — Shared UI components from the \`packages/ui\` workspace

## Testing Patterns

- Use factories for test data creation instead of inline object literals
- Mock Convex in unit tests — never connect to a real Convex deployment in unit tests
- Co-locate test files next to the code they test (\`*.test.ts\` / \`*.test.tsx\`)
`;
}
