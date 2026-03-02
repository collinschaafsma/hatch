import type { ErrorReport } from "../types/index.js";
import { postMonitorEvent } from "./monitor.js";

interface ErrorContext {
	project: string;
	feature: string;
	vmName?: string;
	sshHost?: string;
	monitor?: { convexSiteUrl: string; token: string };
}

interface ErrorDetails {
	source: ErrorReport["source"];
	command?: string;
	step?: string;
	severity?: ErrorReport["severity"];
	error: unknown;
	metadata?: Record<string, unknown>;
}

function normalizeError(error: unknown): { message: string; stack?: string } {
	if (error instanceof Error) {
		return { message: error.message, stack: error.stack };
	}
	return { message: String(error) };
}

export function reportError(ctx: ErrorContext, details: ErrorDetails): void {
	if (!ctx.monitor) return;

	const { message, stack } = normalizeError(details.error);

	const report: ErrorReport = {
		project: ctx.project,
		feature: ctx.feature,
		vmName: ctx.vmName,
		sshHost: ctx.sshHost,
		source: details.source,
		command: details.command,
		step: details.step,
		message,
		stack,
		severity: details.severity ?? "error",
		timestamp: new Date().toISOString(),
		metadata: details.metadata,
	};

	postMonitorEvent(ctx.monitor, "/api/errors", report).catch(() => {});
}
