export function generateNextConfig(): string {
	return `import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@workspace/ui"],
	experimental: {
		optimizePackageImports: ["lucide-react"],
		useCache: true,
	},
};

export default withWorkflow(nextConfig);
`;
}
