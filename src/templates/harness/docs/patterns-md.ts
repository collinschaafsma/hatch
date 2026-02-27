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

## Convex Mutations

Use \`useMutation\` from \`convex/react\` to call Convex mutations. Mutations are transactional and run in the Convex database.

\`\`\`typescript
"use client";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

export function CreateButton() {
  const createItem = useMutation(api.items.create);

  return (
    <button onClick={() => createItem({ name: "New item" })}>
      Create
    </button>
  );
}
\`\`\`

## Convex Conventions

- **Queries** for reads — reactive by default, automatically re-run when data changes
- **Mutations** for writes — transactional, run in the Convex database
- **Actions** for side effects — calling external APIs, sending emails, etc.

## Biome Rules

- Spaces for indentation (not tabs)
- Double quotes for strings
- No non-null assertions (\`!.\`) — use optional chaining (\`?.\`) or guard checks instead
- Trailing commas in multi-line structures

## Import Structure

- \`@/*\` — App root imports (e.g., \`@/components/header\`)
- \`@/components/ui\` — shadcn/ui components

## Testing Patterns

- Use factories for test data creation instead of inline object literals
- Mock Convex in unit tests — never connect to a real Convex deployment in unit tests
- Co-locate test files next to the code they test (\`*.test.ts\` / \`*.test.tsx\`)
`;
}
