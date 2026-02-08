export function generateVercelJson(useConvex = false): string {
	const buildCommand = useConvex
		? 'if [ "$VERCEL_ENV" = "production" ]; then npx convex deploy && pnpm build; else (unset VERCEL VERCEL_ENV && npx convex deploy) && pnpm build; fi'
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
