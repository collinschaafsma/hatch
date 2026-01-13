import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts", "__tests__/**/*.test.ts"],
		exclude: ["node_modules", "__tests__/e2e/**"],
		environment: "node",
		setupFiles: ["__tests__/setup.ts"],
		testTimeout: 30000,
		hookTimeout: 10000,
		pool: "threads",
		poolOptions: {
			threads: {
				singleThread: false,
			},
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/types/**"],
			thresholds: {
				statements: 80,
				branches: 75,
				functions: 80,
				lines: 80,
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
