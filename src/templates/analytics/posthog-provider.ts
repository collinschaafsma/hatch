export function generatePostHogProvider(): string {
	return `"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

// Initialize PostHog at module load (client-side only)
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
	posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
		api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
		capture_pageview: "history_change",
		capture_exceptions: true,
	});
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
	return <PHProvider client={posthog}>{children}</PHProvider>;
}
`;
}
