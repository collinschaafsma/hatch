export function generateRootPackageJson(projectName: string): string {
	return `${JSON.stringify(
		{
			name: projectName,
			private: true,
			scripts: {
				build: "turbo run build",
				dev: "turbo run dev",
				lint: "turbo run lint",
				typecheck: "turbo run typecheck",
				test: "turbo run test",
				"test:ui": "pnpm --filter web test:ui",
				format: "biome format --write .",
				check: "biome check .",
				"db:generate": "pnpm --filter web db:generate",
				"db:migrate": "pnpm --filter web db:migrate",
				"db:push": "pnpm --filter web db:push",
				"db:studio": "pnpm --filter web db:studio",
				"app:setup": "./scripts/setup",
			},
			devDependencies: {
				"@biomejs/biome": "^2.3.11",
				turbo: "^2.7.4",
				typescript: "^5.9.3",
			},
			packageManager: "pnpm@10.28.0",
		},
		null,
		2,
	)}
`;
}
