export function generateRequestLoggerMiddleware(): string {
	return `import { logger } from "./server";

type NextRequest = Request & { url: string; method: string };
type NextContext = { params: Promise<Record<string, string>> };
type RouteHandler = (req: NextRequest, ctx: NextContext) => Promise<Response> | Response;

/**
 * Wraps a Next.js App Router route handler with request logging.
 * Logs method, route, status code, and duration for every request.
 */
export function withRequestLogging(handler: RouteHandler): RouteHandler {
	return async (req: NextRequest, ctx: NextContext): Promise<Response> => {
		const start = performance.now();
		const route = new URL(req.url).pathname;
		const method = req.method;

		try {
			const response = await handler(req, ctx);
			const durationMs = Math.round(performance.now() - start);

			logger.info(\`\${method} \${route} \${response.status} \${durationMs}ms\`, {
				route,
				method,
				statusCode: response.status,
				durationMs,
			});

			return response;
		} catch (error) {
			const durationMs = Math.round(performance.now() - start);

			logger.error(
				\`\${method} \${route} 500 \${durationMs}ms\`,
				error,
				{
					route,
					method,
					statusCode: 500,
					durationMs,
				},
			);

			throw error;
		}
	};
}
`;
}
