export function generateDocsTroubleshooting(): string {
	return `# Troubleshooting

## \`_generated/\` Type Errors

**Symptom:** TypeScript errors referencing files in \`convex/_generated/\`.

**Fix:** Run \`npx convex dev\` to regenerate the Convex client types. These files are machine-generated and must match your current schema and functions.

## Auth CORS Errors

**Symptom:** CORS errors when attempting to log in or verify OTP.

**Fix:** Ensure these values are consistent:
- \`SITE_URL\` matches the actual URL your app is running on
- \`BETTER_AUTH_URL\` matches the same URL
- \`trustedOrigins\` in your Better Auth config includes all valid origins

In development, these should all reference \`http://localhost:3000\`.

## Convex Schema Mismatches

**Symptom:** Runtime errors about missing fields, wrong types, or failed validations from Convex.

**Fix:** Ensure \`apps/web/convex/schema.ts\` matches what is deployed. Run \`npx convex dev\` to push the latest schema. If you changed the schema, all queries and mutations must be updated to match.

## Turbopack vs Webpack Differences

**Symptom:** Features that work in production builds but fail in dev, or vice versa.

**Note:** Next.js 16 uses Turbopack for development by default. Some behaviors differ from the Webpack-based production build. If you encounter issues, test with \`pnpm build && pnpm start\` to confirm whether the issue is Turbopack-specific.

## Preview Deploy Missing CONVEX_DEPLOY_KEY

**Symptom:** Vercel preview deployments cannot connect to Convex, or use the production database instead of a preview.

**Fix:** Set \`CONVEX_DEPLOY_KEY\` in your Vercel project environment variables with the scope set to "Preview". Obtain the key from the Convex dashboard under deploy keys.

## Common Agent Mistakes

These are frequent errors AI coding agents make in this codebase:

- **Wrong import paths:** Use \`@/\` for app root imports, not relative paths like \`../../\`. Use \`@workspace/ui\` for shared UI components.
- **Editing \`_generated/\` files:** Never edit files in \`convex/_generated/\`. They are overwritten by \`npx convex dev\`.
- **Non-null assertions:** Biome forbids \`!.\` (non-null assertions). Use optional chaining (\`?.\`) or explicit null checks instead.
- **Calling DB from components:** All database access must go through \`services/\` files. Components should never import from \`convex/_generated/api\` directly.
`;
}
