export function generateMarketingPage(name: string): string {
	return `import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { Hero } from "./_components/hero";
import { Footer } from "./_components/footer";

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
		url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
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
