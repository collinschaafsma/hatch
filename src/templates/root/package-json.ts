export function generateRootPackageJson(projectName: string): string {
	return `${JSON.stringify(
		{
			name: projectName,
			private: true,
			scripts: {
				build: "turbo run build",
				dev: "turbo run dev",
				lint: "turbo run lint",
				test: "turbo run test",
				"test:ui": "pnpm --filter web test:ui",
				format: "biome format --write .",
				check: "biome check .",
				"db:generate": "pnpm --filter web db:generate",
				"db:migrate": "pnpm --filter web db:migrate",
				"db:push": "pnpm --filter web db:push",
				"db:studio": "pnpm --filter web db:studio",
				"supabase:setup": "./scripts/supabase-setup",
				"supabase:branch": "./scripts/supabase-branch",
				"supabase:env": "./scripts/supabase-env",
				"docker:up": "docker compose up -d postgres",
				"docker:down": "docker compose down",
				"docker:logs": "docker compose logs -f",
				"docker:up:test": "docker compose up -d postgres-test",
				"docker:down:all": "docker compose down -v",
				"docker:reset":
					"docker compose down -v && docker compose up -d postgres",
				setup: "./scripts/setup",
			},
			devDependencies: {
				"@biomejs/biome": "^2.3.11",
				turbo: "^2.7.0",
				typescript: "^5.7.0",
			},
			packageManager: "pnpm@10.0.0",
		},
		null,
		2,
	)}
`;
}
