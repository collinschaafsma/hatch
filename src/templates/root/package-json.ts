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
				"harness:risk-tier": "node scripts/harness/risk-tier.mjs",
				"harness:docs-drift": "node scripts/harness/docs-drift-check.mjs",
				"harness:pre-pr":
					"pnpm lint && pnpm typecheck && pnpm test && node scripts/harness/risk-tier.mjs",
				"harness:ui:capture-browser-evidence":
					"node scripts/harness/ui-capture.mjs",
				"harness:ui:verify-browser-evidence":
					"node scripts/harness/ui-verify.mjs",
			},
			devDependencies: {
				"@biomejs/biome": "^2.4.2",
				turbo: "^2.8.9",
				typescript: "^5.9.3",
			},
			packageManager: "pnpm@10.30.0",
		},
		null,
		2,
	)}
`;
}
