export function generateTurboJson(): string {
	return `${JSON.stringify(
		{
			$schema: "https://turbo.build/schema.json",
			tasks: {
				build: {
					dependsOn: ["^build"],
					outputs: [".next/**", "!.next/cache/**", "dist/**"],
				},
				dev: {
					cache: false,
					persistent: true,
				},
				lint: {
					dependsOn: ["^build"],
				},
				typecheck: {
					dependsOn: ["^build"],
				},
				test: {
					dependsOn: ["^build"],
				},
				"harness:risk-tier": {
					cache: false,
				},
				"harness:pre-pr": {
					dependsOn: ["build", "lint", "typecheck", "test"],
					cache: false,
				},
			},
		},
		null,
		2,
	)}
`;
}
