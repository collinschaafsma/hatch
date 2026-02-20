export function generateHarnessJson(name: string): string {
	return `${JSON.stringify(
		{
			version: "1",
			project: name,
			riskTiers: {
				high: {
					patterns: [
						"apps/web/convex/schema.ts",
						"apps/web/convex/betterAuth/**",
						"apps/web/lib/auth*.ts",
						"apps/web/app/api/auth/**",
						"apps/web/proxy.ts",
					],
					requiredChecks: ["lint", "typecheck", "test", "risk-policy-gate"],
					docsDriftRules: ["docs/api-contracts.md", "docs/architecture.md"],
				},
				medium: {
					patterns: ["apps/web/app/api/**", "apps/web/convex/**"],
					requiredChecks: ["lint", "typecheck", "test"],
					docsDriftRules: ["docs/api-contracts.md"],
				},
				low: {
					patterns: ["**"],
					requiredChecks: ["lint", "typecheck"],
				},
			},
			mergePolicy: {
				high: {
					requiredChecks: ["risk-policy-gate", "Checks", "Tests"],
					requiresHumanReview: true,
				},
				medium: {
					requiredChecks: ["risk-policy-gate", "Checks"],
					requiresHumanReview: false,
				},
				low: {
					requiredChecks: ["Checks"],
					requiresHumanReview: false,
				},
			},
			docsDrift: {
				enabled: true,
				trackedDocs: [
					"docs/architecture.md",
					"docs/patterns.md",
					"docs/api-contracts.md",
					"docs/deployment.md",
				],
			},
			evidence: {
				ui: {
					requiredForPatterns: [
						"apps/web/app/**/*.tsx",
						"packages/ui/**/*.tsx",
					],
					captureScript: "pnpm harness:ui:capture-browser-evidence",
					verifyScript: "pnpm harness:ui:verify-browser-evidence",
				},
			},
		},
		null,
		2,
	)}
`;
}
