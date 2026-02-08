export function generateVercelJson(useConvex = false): string {
	const buildCommand = useConvex
		? "npx convex deploy --cmd 'pnpm build'"
		: "pnpm db:migrate:deploy && pnpm build";

	return `${JSON.stringify(
		{
			$schema: "https://openapi.vercel.sh/vercel.json",
			installCommand: "cd ../.. && corepack enable && pnpm install",
			buildCommand,
		},
		null,
		2,
	)}
`;
}
