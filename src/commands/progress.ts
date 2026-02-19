import { Command } from "commander";
import { log } from "../utils/logger.js";
import { getProject } from "../utils/project-store.js";
import type { PlanProgress } from "../utils/spike-progress.js";
import { checkPlanProgress, fetchRecentLogs } from "../utils/spike-progress.js";
import { checkSSHConnection } from "../utils/ssh.js";
import { getVMByFeature } from "../utils/vm-store.js";

interface ProgressOptions {
	project: string;
	json?: boolean;
}

function timeAgo(isoDate: string): string {
	const now = Date.now();
	const then = new Date(isoDate).getTime();
	const diffMs = now - then;

	if (diffMs < 60_000) return "just now";

	const minutes = Math.floor(diffMs / 60_000);
	if (minutes < 60) return `${minutes}m ago`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;

	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

function formatCost(totalUsd: number): string {
	return `$${totalUsd.toFixed(2)}`;
}

export const progressCommand = new Command()
	.name("progress")
	.description("Show detailed spike progress for a feature VM")
	.argument("<feature>", "Feature name")
	.requiredOption("--project <name>", "Project name")
	.option("--json", "Output as JSON")
	.action(async (feature: string, options: ProgressOptions) => {
		try {
			const vm = await getVMByFeature(options.project, feature);
			if (!vm) {
				log.error(
					`No VM found for feature "${feature}" in project "${options.project}"`,
				);
				process.exit(1);
			}

			const projectRecord = await getProject(options.project);
			if (!projectRecord) {
				log.error(`Project "${options.project}" not found`);
				process.exit(1);
			}

			const reachable = await checkSSHConnection(vm.sshHost);

			let plan: PlanProgress | null = null;
			let recentLogs: string[] = [];

			if (reachable) {
				const [planResult, logsResult] = await Promise.all([
					checkPlanProgress(vm.sshHost, projectRecord.github.repo, feature),
					fetchRecentLogs(vm.sshHost),
				]);
				plan = planResult;
				recentLogs = logsResult;
			}

			if (options.json) {
				const result = {
					vm: {
						name: vm.name,
						feature: vm.feature,
						project: vm.project,
						sshHost: vm.sshHost,
						githubBranch: vm.githubBranch,
						reachable,
						spikeStatus: vm.spikeStatus || null,
						spikeIterations: vm.spikeIterations || null,
						cumulativeCost: vm.cumulativeCost || null,
						originalPrompt: vm.originalPrompt || null,
						prUrl: vm.prUrl || null,
						createdAt: vm.createdAt,
					},
					plan,
					recentLogs,
				};
				console.log(JSON.stringify(result, null, 2));
				return;
			}

			// Human-readable output
			log.blank();

			const ago = timeAgo(vm.createdAt);
			log.step(`Feature: ${vm.feature} (${vm.name})`);

			if (vm.spikeStatus) {
				const iterStr = `iteration ${vm.spikeIterations || 1}`;
				log.info(`Status:  ${vm.spikeStatus} (${iterStr}, ${ago})`);
			} else {
				log.info(`Status:  active (${ago})`);
			}

			if (vm.originalPrompt) {
				const prompt =
					vm.originalPrompt.length > 60
						? `${vm.originalPrompt.slice(0, 57)}...`
						: vm.originalPrompt;
				log.info(`Prompt:  "${prompt}"`);
			}

			if (vm.cumulativeCost) {
				log.info(`Cost:    ${formatCost(vm.cumulativeCost.totalUsd)}`);
			}

			if (vm.prUrl) {
				log.info(`PR:      ${vm.prUrl}`);
			}

			if (!reachable) {
				log.blank();
				log.warn("VM is unreachable — cannot fetch remote progress");
				log.blank();
				return;
			}

			if (plan) {
				log.blank();
				log.info(`Plan: ${plan.completed}/${plan.total} steps completed`);
				for (const step of plan.steps) {
					const check = step.done ? "[x]" : "[ ]";
					log.info(`  ${check} ${step.label}`);
				}
			}

			if (recentLogs.length > 0) {
				log.blank();
				log.info("Recent activity:");
				for (const line of recentLogs) {
					log.info(`  ${line}`);
				}
			}

			log.blank();
		} catch (error) {
			log.blank();
			log.error(
				`Failed to get progress: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
