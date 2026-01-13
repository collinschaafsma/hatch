import { vi } from "vitest";

export function createMockExeca(overrides?: {
	stdout?: string;
	stderr?: string;
	exitCode?: number;
}) {
	return vi.fn().mockResolvedValue({
		stdout: overrides?.stdout ?? "",
		stderr: overrides?.stderr ?? "",
		exitCode: overrides?.exitCode ?? 0,
		failed: false,
		timedOut: false,
		isCanceled: false,
		killed: false,
	});
}

export function createFailingMockExeca(error: Error) {
	return vi.fn().mockRejectedValue(error);
}

export function createMockPrompts(responses: Record<string, unknown>) {
	return vi.fn().mockImplementation((questions) => {
		const result: Record<string, unknown> = {};
		for (const q of questions) {
			if (q.name && responses[q.name] !== undefined) {
				result[q.name] = responses[q.name];
			}
		}
		return Promise.resolve(result);
	});
}

export function createMockOra() {
	const spinner = {
		start: vi.fn().mockReturnThis(),
		succeed: vi.fn().mockReturnThis(),
		fail: vi.fn().mockReturnThis(),
		stop: vi.fn().mockReturnThis(),
		text: "",
		color: "cyan" as const,
	};
	return {
		default: vi.fn(() => spinner),
		spinner,
	};
}
