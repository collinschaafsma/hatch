export function generateDrizzleConfig(): string {
	return `import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	...(process.env.DATABASE_URL && {
		dbCredentials: {
			url: process.env.DATABASE_URL,
		},
	}),
});
`;
}
