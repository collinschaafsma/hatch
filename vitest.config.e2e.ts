import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["__tests__/e2e/**/*.test.ts"],
		exclude: ["node_modules"],
		environment: "node",
		testTimeout: 600000,
		hookTimeout: 120000,
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
		retry: 1,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
