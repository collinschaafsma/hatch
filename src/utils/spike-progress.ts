import { sshExec } from "./ssh.js";

export interface PlanStep {
	label: string;
	done: boolean;
}

export interface PlanProgress {
	completed: number;
	total: number;
	steps: PlanStep[];
}

/**
 * Check plan progress by reading the plan file from the VM
 */
export async function checkPlanProgress(
	sshHost: string,
	repo: string,
	feature: string,
): Promise<PlanProgress | null> {
	try {
		const { stdout } = await sshExec(
			sshHost,
			`cat ~/${repo}/docs/plans/${feature}.md 2>/dev/null`,
			{ timeoutMs: 10_000 },
		);

		if (!stdout.trim()) return null;

		const steps: PlanStep[] = [];
		for (const line of stdout.split("\n")) {
			const checkedMatch = line.match(/^- \[x\]\s+(.+)/i);
			const uncheckedMatch = line.match(/^- \[ \]\s+(.+)/);

			if (checkedMatch) {
				steps.push({ label: checkedMatch[1].trim(), done: true });
			} else if (uncheckedMatch) {
				steps.push({ label: uncheckedMatch[1].trim(), done: false });
			}
		}

		if (steps.length === 0) return null;

		return {
			completed: steps.filter((s) => s.done).length,
			total: steps.length,
			steps,
		};
	} catch {
		return null;
	}
}

/**
 * Fetch recent lines from the spike log
 */
export async function fetchRecentLogs(
	sshHost: string,
	count = 10,
): Promise<string[]> {
	try {
		const { stdout } = await sshExec(
			sshHost,
			`tail -n ${count} ~/spike.log 2>/dev/null`,
			{ timeoutMs: 10_000 },
		);

		if (!stdout.trim()) return [];
		return stdout.trim().split("\n");
	} catch {
		return [];
	}
}

/**
 * Fetch the spike result JSON from the VM
 */
export async function fetchSpikeResult(
	sshHost: string,
): Promise<Record<string, unknown> | null> {
	try {
		const { stdout } = await sshExec(
			sshHost,
			"cat ~/spike-result.json 2>/dev/null",
			{ timeoutMs: 10_000 },
		);

		if (!stdout.trim()) return null;
		return JSON.parse(stdout.trim());
	} catch {
		return null;
	}
}
