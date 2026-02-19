export function generateServerLogger(): string {
	return `import "server-only";
import getPostHogClient from "@/lib/posthog";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
	[key: string]: unknown;
}

const LOG_DIR = path.join(os.homedir(), ".harness", "logs");
const LOG_FILE = path.join(LOG_DIR, "app.jsonl");
let logDirReady = false;

class ServerLogger {
	/**
	 * Log a debug message
	 */
	debug(message: string, context?: LogContext): void {
		this.log("debug", message, context);
	}

	/**
	 * Log an info message
	 */
	info(message: string, context?: LogContext): void {
		this.log("info", message, context);
	}

	/**
	 * Log a warning message
	 */
	warn(message: string, context?: LogContext): void {
		this.log("warn", message, context);
	}

	/**
	 * Log an error and send it to PostHog
	 * @param message - Error message
	 * @param error - Error object or unknown error
	 * @param context - Additional context to attach to the error
	 * @param distinctId - Optional PostHog distinct_id to associate the error with a user
	 */
	error(
		message: string,
		error?: Error | unknown,
		context?: LogContext,
		distinctId?: string,
	): void {
		this.log("error", message, context);

		// Send to PostHog (fire-and-forget)
		this.captureError(message, error, context, distinctId).catch((err) => {
			console.error("Error in captureError:", err);
		});
	}

	/**
	 * Capture error to PostHog server-side
	 */
	private async captureError(
		message: string,
		error?: Error | unknown,
		context?: LogContext,
		distinctId?: string,
	): Promise<void> {
		const posthog = getPostHogClient();
		if (!posthog) return;

		try {
			const errorMessage = error instanceof Error ? error.message : message;
			const errorStack = error instanceof Error ? error.stack : undefined;

			posthog.capture({
				distinctId: distinctId || "server",
				event: "error",
				properties: {
					...context,
					message,
					errorMessage,
					errorStack,
					source: "logger",
				},
			});

			await posthog.flush();
		} catch (err) {
			// Fail silently if PostHog tracking fails
			console.error("Failed to send error to PostHog:", err);
		}
	}

	/**
	 * Internal logging method
	 */
	private log(level: LogLevel, message: string, context?: LogContext): void {
		const timestamp = new Date().toISOString();
		const prefix = \`[\${timestamp}] [\${level.toUpperCase()}]\`;

		if (context && Object.keys(context).length > 0) {
			console[level](\`\${prefix} \${message}\`, context);
		} else {
			console[level](\`\${prefix} \${message}\`);
		}

		// Write JSON log to file in development
		if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
			try {
				if (!logDirReady) {
					fs.mkdirSync(LOG_DIR, { recursive: true });
					logDirReady = true;
				}
				const entry = JSON.stringify({ timestamp, level, message, ...context });
				fs.appendFileSync(LOG_FILE, \`\${entry}\\n\`);
			} catch {
				// Never crash the app due to logging failures
			}
		}
	}
}

// Export a singleton instance
export const logger = new ServerLogger();
`;
}
