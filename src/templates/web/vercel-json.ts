export function generateVercelJson(): string {
	const buildCommand =
		'if [ "$VERCEL_ENV" = "production" ]; then npx convex deploy && pnpm build; else npx convex deploy --cmd \'pnpm build\'; fi';

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
