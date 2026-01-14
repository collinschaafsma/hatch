import type { CreateOptions } from "../../types/index.js";

export function generateWorkflowProgressRoute(options: CreateOptions): string {
	const authCheck = options.useWorkOS
		? `// Authenticate user
		const { user } = await withAuth();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}`
		: `// Authenticate user
		const session = await getSession();
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}`;

	const authImport = options.useWorkOS
		? `import { withAuth } from "@workos-inc/authkit-nextjs";`
		: `import { getSession } from "@/lib/auth";`;

	return `import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
${authImport}
import { WORKFLOW_STREAM_NAMESPACE } from "@/lib/workflow-progress/types";

/**
 * GET /api/workflow-progress/[runId]
 *
 * Streams workflow progress events as Server-Sent Events (SSE).
 * Supports reconnection via \`startIndex\` query parameter.
 *
 * Query parameters:
 * - startIndex: Event index to start from (for reconnection)
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	try {
		${authCheck}

		const { runId } = await params;

		if (!runId) {
			return NextResponse.json(
				{ error: "Missing runId parameter" },
				{ status: 400 },
			);
		}

		// Parse query parameters
		const url = new URL(request.url);
		const startIndex = Number.parseInt(
			url.searchParams.get("startIndex") || "0",
			10,
		);

		// Get the workflow run
		const run = getRun(runId);

		// Get the readable stream with namespace and optional startIndex for reconnection
		const readable = run.getReadable<Record<string, unknown>>({
			namespace: WORKFLOW_STREAM_NAMESPACE,
			startIndex,
		});

		// Transform the stream to SSE format
		const encoder = new TextEncoder();
		let eventIndex = startIndex;

		const transformStream = new TransformStream<
			Record<string, unknown>,
			Uint8Array
		>({
			transform(chunk, controller) {
				// Format as SSE event with index for reconnection tracking
				const sseData = JSON.stringify({
					...chunk,
					_index: eventIndex++,
				});
				controller.enqueue(encoder.encode(\`data: \${sseData}\\n\\n\`));
			},
		});

		const sseStream = readable.pipeThrough(transformStream);

		return new Response(sseStream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no", // Disable nginx buffering
			},
		});
	} catch (error) {
		console.error("Workflow progress stream error:", error);

		// Check if it's a "run not found" error
		if (
			error instanceof Error &&
			error.message.toLowerCase().includes("not found")
		) {
			return NextResponse.json(
				{ error: "Workflow run not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json(
			{
				error: "Failed to stream workflow progress",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
`;
}
