export function generateWebPackageJson(): string {
	// Build dependencies object with Convex + Better Auth packages, alphabetically sorted
	const dependencies: Record<string, string> = {
		"@ai-sdk/openai": "^1.3.22",
		"@ai-sdk/react": "^3.0.35",
		"@convex-dev/better-auth": "^0.10.0",
		"@convex-dev/workflow": "^0.2.0",
		"@posthog/ai": "^7.4.2",
		"@workspace/ui": "workspace:*",
		ai: "^6.0.33",
		"better-auth": "^1.4.12",
		convex: "^1.31.0",
		"convex-helpers": "^0.1.0",
		next: "^16.1.1",
		"posthog-js": "^1.320.0",
		"posthog-node": "^5.20.0",
		react: "^19.2.3",
		"react-dom": "^19.2.3",
		resend: "^6.7.0",
		"server-only": "^0.0.1",
		"tw-animate-css": "^1.4.0",
		zod: "^4.3.5",
	};

	// Sort dependencies alphabetically
	const sortedDeps = Object.fromEntries(
		Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)),
	);

	// Build scripts
	const scripts: Record<string, string> = {
		dev: "next dev --turbopack",
		build: "next build",
		start: "next start",
		lint: "biome check .",
		typecheck: "tsc --noEmit",
		test: "vitest run",
		"test:watch": "vitest",
		"test:ui": "vitest --ui",
		"test:coverage": "vitest run --coverage",
		"convex:dev": "npx convex dev",
		"convex:deploy": "npx convex deploy",
	};

	// Build devDependencies
	const devDependencies: Record<string, string> = {
		"@faker-js/faker": "^10.2.0",
		"@tailwindcss/postcss": "^4.1.18",
		"@testing-library/dom": "^10.4.1",
		"@testing-library/jest-dom": "^6.9.1",
		"@testing-library/react": "^16.3.1",
		"@testing-library/user-event": "^14.6.1",
		"@types/node": "^25.0.8",
		"@types/react": "^19.2.8",
		"@types/react-dom": "^19.2.3",
		"@vitejs/plugin-react": "^5.1.2",
		dotenv: "^17.2.3",
		jsdom: "^27.4.0",
		postcss: "^8.5.6",
		tailwindcss: "^4.1.18",
		typescript: "^5.9.3",
		"vite-tsconfig-paths": "^6.0.4",
		vitest: "^4.0.17",
	};

	return `${JSON.stringify(
		{
			name: "web",
			version: "0.0.1",
			private: true,
			scripts,
			dependencies: sortedDeps,
			devDependencies,
		},
		null,
		2,
	)}
`;
}
