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
			},
		},
		null,
		2,
	)}
`;
}
