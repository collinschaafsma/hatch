export function generateDbMigrateSkill(): string {
	return `---
name: db-migrate
description: Handle Drizzle ORM migrations - generate, apply, and resolve merge conflicts. Use when schema changes, migrations fail, or conflicts occur during git merge.
allowed-tools: Bash(pnpm:*), Bash(git:*), Read, Grep
---

# Drizzle Migration Management

## Commands

Generate migration from schema changes:
\`\`\`bash
pnpm db:generate
\`\`\`

Apply migrations:
\`\`\`bash
pnpm db:migrate
\`\`\`

Open Drizzle Studio:
\`\`\`bash
pnpm db:studio
\`\`\`

Start PostgreSQL:
\`\`\`bash
pnpm docker:up
\`\`\`

## Key Files

- \`apps/web/db/schema.ts\` - Database schema definitions
- \`apps/web/db/index.ts\` - Database client
- \`apps/web/drizzle.config.ts\` - Drizzle configuration
- \`apps/web/drizzle/\` - Generated migration files

## Workflow

1. Modify schema in \`apps/web/db/schema.ts\`
2. Generate migration: \`pnpm db:generate\`
3. Review generated SQL in \`apps/web/drizzle/\`
4. Apply migration: \`pnpm db:migrate\`
5. Commit migration files

## Merge Conflict Resolution

When migrations conflict during git merge:

1. **Identify conflicts**: Check for conflicting files in \`apps/web/drizzle/\`
2. **Keep both migrations**: Don't merge migration content - keep as separate files
3. **Fix timestamps**: Ensure migration filenames have unique timestamps
4. **Regenerate metadata**: Run \`pnpm db:generate\` to update snapshot
5. **Test locally**: Apply migrations to dev database before committing
6. **Verify schema**: Compare schema.ts with actual database state

## Instructions

1. Ask what migration task is needed (generate, apply, or conflict resolution)
2. For conflicts, identify the conflicting files
3. Guide through resolution steps
4. Verify with \`pnpm db:generate\` after resolution
5. Test migrations work before committing

## Common Issues

### Schema out of sync
If database doesn't match code, introspect current state:
\`\`\`bash
pnpm db:studio
\`\`\`

### Migration already applied
Check migration status in \`drizzle/__drizzle_migrations\` table.

### Type errors after schema change
Run \`pnpm typecheck\` to find consumers that need updating.
`;
}
