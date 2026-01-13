export function generateVercelJson(): string {
	return `${JSON.stringify(
		{
			$schema: "https://openapi.vercel.sh/vercel.json",
			buildCommand: "pnpm db:migrate:deploy && pnpm build",
		},
		null,
		2,
	)}
`;
}
