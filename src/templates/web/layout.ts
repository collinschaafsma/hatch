export function generateRootLayout(useWorkOS: boolean): string {
	if (useWorkOS) {
		return `import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import "./globals.css";

// Defer analytics loading - not needed for initial render
const PostHogProvider = dynamic(
	() => import("@/components/providers/posthog").then((m) => m.PostHogProvider),
	{ ssr: false }
);

export const metadata: Metadata = {
	title: "My App",
	description: "Built with Hatch",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>
				<PostHogProvider>
					<AuthKitProvider>{children}</AuthKitProvider>
				</PostHogProvider>
			</body>
		</html>
	);
}
`;
	}

	return `import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";

// Defer analytics loading - not needed for initial render
const PostHogProvider = dynamic(
	() => import("@/components/providers/posthog").then((m) => m.PostHogProvider),
	{ ssr: false }
);

export const metadata: Metadata = {
	title: "My App",
	description: "Built with Hatch",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>
				<PostHogProvider>{children}</PostHogProvider>
			</body>
		</html>
	);
}
`;
}
