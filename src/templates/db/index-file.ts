export function generateDbIndex(): string {
	return `import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let dbInstance: NodePgDatabase<typeof schema> | null = null;

export function getDb(): NodePgDatabase<typeof schema> {
	if (dbInstance) return dbInstance;

	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL environment variable is required");
	}

	dbInstance = drizzle(process.env.DATABASE_URL, { schema });
	return dbInstance;
}

// Export a proxy that lazily initializes the db
// This allows imports without throwing at build time
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
	get(_, prop) {
		return getDb()[prop as keyof NodePgDatabase<typeof schema>];
	},
});
`;
}
