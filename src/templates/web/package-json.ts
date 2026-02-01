export function generateWebPackageJson(useWorkOS: boolean): string {
	// Build dependencies object with auth-specific packages, alphabetically sorted
	const dependencies: Record<string, string> = {
		"@ai-sdk/react": "^3.0.35",
		"@posthog/ai": "^7.4.2",
		"@workspace/ui": "workspace:*",
		ai: "^6.0.33",
		...(useWorkOS
			? { "@workos-inc/authkit-nextjs": "^2.13.0" }
			: { "better-auth": "^1.4.12" }),
		"drizzle-orm": "^0.45.1",
		next: "^16.1.1",
		"next-safe-action": "^8.0.11",
		pg: "^8.16.3",
		"posthog-js": "^1.320.0",
		"posthog-node": "^5.20.0",
		react: "^19.2.3",
		"react-dom": "^19.2.3",
		...(!useWorkOS ? { resend: "^6.7.0" } : {}),
		"server-only": "^0.0.1",
		swr: "^2.3.3",
		"tw-animate-css": "^1.4.0",
		workflow: "^4.0.1-beta.45",
		zod: "^4.3.5",
	};

	// Sort dependencies alphabetically
	const sortedDeps = Object.fromEntries(
		Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)),
	);

	return `${JSON.stringify(
		{
			name: "web",
			version: "0.0.1",
			private: true,
			scripts: {
				dev: "next dev --turbopack",
				build: "next build",
				start: "next start",
				lint: "biome check .",
				typecheck: "tsc --noEmit",
				test: "vitest run",
				"test:watch": "vitest",
				"test:ui": "vitest --ui",
				"test:coverage": "vitest run --coverage",
				"db:generate": "drizzle-kit generate",
				"db:migrate": "drizzle-kit migrate",
				"db:migrate:deploy": "drizzle-kit migrate",
				"db:push": "drizzle-kit push",
				"db:studio": "drizzle-kit studio",
			},
			dependencies: sortedDeps,
			devDependencies: {
				"@faker-js/faker": "^10.2.0",
				"@tailwindcss/postcss": "^4.1.18",
				"@testing-library/dom": "^10.4.1",
				"@testing-library/jest-dom": "^6.9.1",
				"@testing-library/react": "^16.3.1",
				"@testing-library/user-event": "^14.6.1",
				"@types/node": "^25.0.8",
				"@types/pg": "^8.16.0",
				"@types/react": "^19.2.8",
				"@types/react-dom": "^19.2.3",
				"@vitejs/plugin-react": "^5.1.2",
				dotenv: "^17.2.3",
				"drizzle-kit": "^0.31.8",
				jsdom: "^27.4.0",
				postcss: "^8.5.6",
				tailwindcss: "^4.1.18",
				typescript: "^5.9.3",
				"vite-tsconfig-paths": "^6.0.4",
				vitest: "^4.0.17",
			},
		},
		null,
		2,
	)}
`;
}
