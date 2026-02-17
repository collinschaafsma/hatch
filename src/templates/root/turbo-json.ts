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
					env: ["TEST_DATABASE_URL"],
				},
				"db:generate": {
					cache: false,
				},
				"db:migrate": {
					cache: false,
				},
				"db:studio": {
					cache: false,
					persistent: true,
				},
				"harness:risk-tier": {
					cache: false,
				},
				"harness:pre-pr": {
					dependsOn: ["lint", "typecheck", "test"],
					cache: false,
				},
			},
		},
		null,
		2,
	)}
`;
}
