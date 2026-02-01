export function generateSitemap(): string {
	return `import type { MetadataRoute } from "next";

// Get app URL, checking multiple sources for different environments
function getBaseUrl(): string {
	if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
	if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return \`https://\${process.env.VERCEL_PROJECT_PRODUCTION_URL}\`;
	if (process.env.VERCEL_URL) return \`https://\${process.env.VERCEL_URL}\`;
	return "http://localhost:3000";
}

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = getBaseUrl();

	return [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 1,
		},
		{
			url: \`\${baseUrl}/login\`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.5,
		},
	];
}
`;
}
