export function generateEvalsSetup(): string {
	return `/**
 * Evalite Setup
 *
 * This file runs before all evals to configure the environment.
 */
import path from "node:path";
import { config } from "dotenv";

// Load .env.local file
config({ path: path.resolve(__dirname, "../.env.local") });

// Ensure EVALITE flag is set
process.env.EVALITE = "true";
`;
}
