export function generateNextConfig(): string {
	return `import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
    useCache: true,
  },
  // Expose Vercel URLs to client-side for deployment URL detection
  env: {
    NEXT_PUBLIC_VERCEL_URL: process.env.VERCEL_URL,
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },
  // Allow dev server connections from VM preview URLs (set via ALLOWED_DEV_ORIGINS env var)
  ...(process.env.ALLOWED_DEV_ORIGINS && {
    allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS.split(","),
  }),
};

export default withWorkflow(nextConfig);
`;
}
