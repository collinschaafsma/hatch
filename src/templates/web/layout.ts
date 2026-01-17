export function generateRootLayout(useWorkOS: boolean, name: string): string {
	const metadata = `export const metadata: Metadata = {
	metadataBase: new URL(
		process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
	),
	title: {
		default: "${name}",
		template: "%s | ${name}",
	},
	description: "${name} - Built with Hatch",
	keywords: ["${name}", "web app"],
	authors: [{ name: "${name}" }],
	openGraph: {
		type: "website",
		locale: "en_US",
		siteName: "${name}",
		title: "${name}",
		description: "${name} - Built with Hatch",
	},
	twitter: {
		card: "summary_large_image",
		title: "${name}",
		description: "${name} - Built with Hatch",
	},
	robots: {
		index: true,
		follow: true,
	},
};`;

	if (useWorkOS) {
		return `import type { Metadata } from "next";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { PostHogProvider } from "@/components/providers/posthog";
import "./globals.css";

${metadata}

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

${metadata}

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
