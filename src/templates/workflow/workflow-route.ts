export function generateWorkflowRoute(): string {
	return `import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { aiAgentWorkflow } from "@/workflows/ai-agent";

export async function POST(req: Request) {
	try {
		const { prompt } = await req.json();

		if (!prompt) {
			return NextResponse.json(
				{ error: "Prompt is required" },
				{ status: 400 },
			);
		}

		const result = await start(aiAgentWorkflow, [prompt]);

		return NextResponse.json({
			result,
			status: "started",
		});
	} catch (error) {
		console.error("Workflow error:", error);
		return NextResponse.json(
			{ error: "Failed to start workflow" },
			{ status: 500 },
		);
	}
}
`;
}
