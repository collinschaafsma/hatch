export function generateNextConfig(): string {
	return `import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@repo/ui"],
};

export default withWorkflow(nextConfig);
`;
}
