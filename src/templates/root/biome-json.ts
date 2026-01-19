export function generateBiomeJson(): string {
	return `${JSON.stringify(
		{
			$schema: "https://biomejs.dev/schemas/2.3.11/schema.json",
			vcs: {
				enabled: true,
				clientKind: "git",
				useIgnoreFile: true,
			},
			files: {
				ignoreUnknown: false,
				includes: [
					"**/*.ts",
					"**/*.tsx",
					"**/*.js",
					"**/*.jsx",
					"**/*.json",
					"!**/node_modules/**",
					"!**/.next/**",
					"!**/dist/**",
					"!**/drizzle/**",
					"!**/packages/ui/src/components/**",
				],
			},
			formatter: {
				enabled: true,
				indentStyle: "space",
				indentWidth: 2,
			},
			assist: {
				enabled: true,
				actions: {
					source: {
						organizeImports: {
							level: "off",
						},
					},
				},
			},
			linter: {
				enabled: true,
				rules: {
					recommended: true,
				},
			},
			javascript: {
				formatter: {
					quoteStyle: "double",
					semicolons: "always",
				},
			},
		},
		null,
		2,
	)}
`;
}
