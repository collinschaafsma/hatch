export function generateChatRoute(): string {
	return `import { convertToModelMessages, streamText, type UIMessage } from "ai";

export async function POST(req: Request) {
	const { messages }: { messages: UIMessage[] } = await req.json();

	const result = streamText({
		model: "openai/gpt-5",
		messages: await convertToModelMessages(messages),
		system: "You are a helpful assistant.",
	});

	return result.toUIMessageStreamResponse();
}
`;
}
