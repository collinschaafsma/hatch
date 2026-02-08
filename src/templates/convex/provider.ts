export function generateConvexProvider(): string {
	return `"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { authClient } from "@/lib/auth-client";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(
	process.env.NEXT_PUBLIC_CONVEX_URL as string,
);

export function ConvexClientProvider({
	children,
	initialToken,
}: {
	children: ReactNode;
	initialToken?: string | null;
}) {
	return (
		<ConvexBetterAuthProvider
			client={convex}
			authClient={authClient}
			initialToken={initialToken}
		>
			{children}
		</ConvexBetterAuthProvider>
	);
}
`;
}
