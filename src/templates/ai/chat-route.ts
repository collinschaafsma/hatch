export function generateChatRoute(): string {
	return `import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { observedModel } from "@/lib/observed-model";

export async function POST(req: Request) {
	const { messages }: { messages: UIMessage[] } = await req.json();

	const result = streamText({
		model: observedModel("gpt-4o", { agent: "chat" }),
		messages: await convertToModelMessages(messages),
		system: "You are a helpful assistant.",
	});

	return result.toUIMessageStreamResponse();
}
`;
}
