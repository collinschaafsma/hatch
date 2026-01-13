export function generatePostHogServer(): string {
	return `import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

function getPostHogClient(): PostHog | null {
	if (posthogClient) return posthogClient;

	const apiKey = process.env.POSTHOG_API_KEY;
	if (!apiKey) return null;

	posthogClient = new PostHog(apiKey, {
		host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
		flushAt: 1,
		flushInterval: 0,
	});

	return posthogClient;
}

export default getPostHogClient;

export async function trackServerEvent(
	distinctId: string,
	event: string,
	properties?: Record<string, unknown>,
) {
	const client = getPostHogClient();
	if (!client) return;

	client.capture({
		distinctId,
		event,
		properties,
	});
	await client.flush();
}
`;
}
