export function generateVercelJson(): string {
	return `${JSON.stringify(
		{
			$schema: "https://openapi.vercel.sh/vercel.json",
			installCommand: "pnpm install",
			buildCommand: "pnpm db:migrate:deploy && pnpm build",
		},
		null,
		2,
	)}
`;
}
