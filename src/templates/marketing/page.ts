export function generateMarketingPage(name: string): string {
	return `import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { Hero } from "./_components/hero";
import { Footer } from "./_components/footer";

// Get app URL, checking multiple sources for different environments
function getAppUrl(): string {
	if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
	if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return \`https://\${process.env.VERCEL_PROJECT_PRODUCTION_URL}\`;
	if (process.env.VERCEL_URL) return \`https://\${process.env.VERCEL_URL}\`;
	return "http://localhost:3000";
}

export const metadata: Metadata = {
	title: "Home",
	description: "Welcome to ${name}",
};

export default async function HomePage() {
	"use cache";
	cacheLife("days");
	cacheTag("marketing-home");

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "${name}",
		url: getAppUrl(),
	};

	return (
		<>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data for SEO
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<main className="min-h-screen flex flex-col">
				<Hero />
				<Footer />
			</main>
		</>
	);
}
`;
}
