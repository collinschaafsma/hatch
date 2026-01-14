export function generateRootLayout(useWorkOS: boolean): string {
	if (useWorkOS) {
		return `import type { Metadata } from "next";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { PostHogProvider } from "@/components/providers/posthog";
import "./globals.css";

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
import { PostHogProvider } from "@/components/providers/posthog";
import "./globals.css";

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
