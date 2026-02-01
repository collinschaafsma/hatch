export function generateClientLogger(): string {
	return `import posthog from "posthog-js";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
	[key: string]: unknown;
}

class ClientLogger {
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
	 * Log an error and send it to PostHog error tracking
	 */
	error(message: string, error?: Error | unknown, context?: LogContext): void {
		this.log("error", message, context);

		// Send to PostHog error tracking
		this.captureError(message, error, context);
	}

	/**
	 * Capture error to PostHog client-side
	 */
	private captureError(
		message: string,
		error?: Error | unknown,
		context?: LogContext,
	): void {
		try {
			if (!posthog.__loaded) return;

			if (error instanceof Error) {
				posthog.captureException(error, {
					...context,
					message,
				});
			} else if (error) {
				const errorObj = new Error(message);
				posthog.captureException(errorObj, {
					...context,
					originalError: error,
				});
			} else {
				const errorObj = new Error(message);
				posthog.captureException(errorObj, context);
			}
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
	}
}

// Export a singleton instance
export const logger = new ClientLogger();
`;
}
