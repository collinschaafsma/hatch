export function generateNextConfig(): string {
	return `import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
    useCache: true,
  },
  // Allow dev server connections from VM preview URLs (set via ALLOWED_DEV_ORIGINS env var)
  ...(process.env.ALLOWED_DEV_ORIGINS && {
    allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS.split(","),
  }),
};

export default withWorkflow(nextConfig);
`;
}
