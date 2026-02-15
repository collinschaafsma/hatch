export function generateRootLayout(name: string): string {
	const metadata = `// Get app URL for metadata, checking multiple sources
function getAppUrl(): string {
	if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
	if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return \`https://\${process.env.VERCEL_PROJECT_PRODUCTION_URL}\`;
	if (process.env.VERCEL_URL) return \`https://\${process.env.VERCEL_URL}\`;
	return "http://localhost:3000";
}

export const metadata: Metadata = {
	metadataBase: new URL(getAppUrl()),
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
