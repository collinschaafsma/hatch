export function generateVercelJson(): string {
	const buildCommand =
		'if [ "$VERCEL_ENV" = "production" ]; then npx convex deploy && pnpm build; else (unset VERCEL VERCEL_ENV && npx convex deploy) && pnpm build; fi';

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
