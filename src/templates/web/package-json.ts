export function generateWebPackageJson(): string {
	// Build dependencies object with Convex + Better Auth packages, alphabetically sorted
	const dependencies: Record<string, string> = {
		"@convex-dev/better-auth": "^0.10.10",
		"@posthog/ai": "^7.8.11",
		"better-auth": "1.4.9",
		"class-variance-authority": "^0.7.1",
		clsx: "^2.1.1",
		convex: "^1.31.7",
		"convex-helpers": "^0.1.112",
		"lucide-react": "^0.511.0",
		next: "^16.1.6",
		"posthog-js": "^1.347.2",
		"posthog-node": "^5.24.15",
		react: "^19.2.4",
		"react-dom": "^19.2.4",
		resend: "^6.9.2",
		"server-only": "^0.0.1",
		"tailwind-merge": "^3.3.0",
		"tw-animate-css": "^1.4.0",
		zod: "^4.3.6",
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
		"@edge-runtime/vm": "^5.0.0",
		"@faker-js/faker": "^10.3.0",
		"@tailwindcss/postcss": "^4.1.18",
		"@testing-library/dom": "^10.4.1",
		"@testing-library/jest-dom": "^6.9.1",
		"@testing-library/react": "^16.3.2",
		"@testing-library/user-event": "^14.6.1",
		"@types/node": "^25.2.3",
		"@types/react": "^19.2.14",
		"@types/react-dom": "^19.2.3",
		"@vitejs/plugin-react": "^5.1.4",
		"convex-test": "^0.0.41",
		dotenv: "^17.3.1",
		jsdom: "^28.1.0",
		postcss: "^8.5.6",
		shadcn: "^2.5.0",
		tailwindcss: "^4.1.18",
		typescript: "^5.9.3",
		"vite-tsconfig-paths": "^6.1.1",
		vitest: "^4.0.18",
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
