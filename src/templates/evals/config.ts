export function generateEvaliteConfig(): string {
	return `import { defineConfig } from "evalite/config";

export default defineConfig({
	// Run evals sequentially to avoid rate limits
	maxConcurrency: 1,
	// 5 minute timeout for long-running evals
	testTimeout: 300000,
});
`;
}
