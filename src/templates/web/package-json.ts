export function generateWebPackageJson(useWorkOS: boolean): string {
	const authDeps = useWorkOS
		? {
				"@workos-inc/authkit-nextjs": "^2.13.0",
			}
		: {
				"better-auth": "^1.4.12",
				resend: "^6.7.0",
			};

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
			dependencies: {
				next: "^16.1.1",
				react: "^19.2.3",
				"react-dom": "^19.2.3",
				...authDeps,
				"drizzle-orm": "^0.45.1",
				pg: "^8.16.3",
				ai: "^6.0.33",
				"@ai-sdk/react": "^3.0.35",
				workflow: "^4.0.1-beta.45",
				"posthog-js": "^1.320.0",
				"posthog-node": "^5.20.0",
				"@posthog/ai": "^7.4.2",
				zod: "^4.3.5",
				"@workspace/ui": "workspace:*",
				"next-safe-action": "^8.0.11",
				"server-only": "^0.0.1",
			},
			devDependencies: {
				"@types/node": "^25.0.8",
				"@types/pg": "^8.16.0",
				"@types/react": "^19.2.8",
				"@types/react-dom": "^19.2.3",
				"drizzle-kit": "^0.31.8",
				typescript: "^5.9.3",
				tailwindcss: "^4.1.18",
				"@tailwindcss/postcss": "^4.1.18",
				postcss: "^8.5.6",
				vitest: "^4.0.17",
				"@vitejs/plugin-react": "^5.1.2",
				"@testing-library/react": "^16.3.1",
				"@testing-library/dom": "^10.4.1",
				"@testing-library/jest-dom": "^6.9.1",
				"@testing-library/user-event": "^14.6.1",
				jsdom: "^27.4.0",
				"vite-tsconfig-paths": "^6.0.4",
				"@faker-js/faker": "^10.2.0",
				dotenv: "^17.2.3",
			},
		},
		null,
		2,
	)}
`;
}
