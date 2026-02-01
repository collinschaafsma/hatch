export function generateRobots(): string {
	return `import type { MetadataRoute } from "next";

// Get app URL, checking multiple sources for different environments
function getBaseUrl(): string {
	if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
	if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return \`https://\${process.env.VERCEL_PROJECT_PRODUCTION_URL}\`;
	if (process.env.VERCEL_URL) return \`https://\${process.env.VERCEL_URL}\`;
	return "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
	const baseUrl = getBaseUrl();

	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/api/", "/dashboard/"],
			},
		],
		sitemap: \`\${baseUrl}/sitemap.xml\`,
	};
}
`;
}
