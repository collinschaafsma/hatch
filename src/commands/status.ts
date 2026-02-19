import { Command } from "commander";
import { execa } from "execa";
import type { PRStatus, StatusResult, VMStatus } from "../types/index.js";
import { log } from "../utils/logger.js";
import { listProjects } from "../utils/project-store.js";
import { checkPlanProgress } from "../utils/spike-progress.js";
import { checkSSHConnection, sshExec } from "../utils/ssh.js";
import { listVMs, listVMsByProject, updateVM } from "../utils/vm-store.js";

interface StatusOptions {
	json?: boolean;
	project?: string;
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

async function fetchPRStatus(prUrl: string): Promise<PRStatus | null> {
	try {
		const result = await execa(
			"gh",
			[
				"pr",
				"view",
				prUrl,
				"--json",
				"number,title,url,state,reviewDecision,statusCheckRollup,mergeable",
			],
			{ stdio: "pipe", timeout: 15_000 },
		);

		const data = JSON.parse(result.stdout);

		const checks: Array<{
			name: string;
			status: string;
			conclusion: string;
		}> = (data.statusCheckRollup || []).map(
			(c: { name?: string; status?: string; conclusion?: string }) => ({
				name: c.name || "",
				status: c.status || "",
				conclusion: c.conclusion || "",
			}),
		);

		let checksStatus: "pass" | "fail" | "pending" = "pass";
		if (checks.length === 0) {
			checksStatus = "pending";
		} else if (checks.some((c) => c.conclusion === "FAILURE")) {
			checksStatus = "fail";
		} else if (
			checks.some((c) => c.status === "IN_PROGRESS" || c.status === "QUEUED")
		) {
			checksStatus = "pending";
		}

		return {
			number: data.number,
			title: data.title,
			url: data.url,
			state: data.state,
			reviewDecision: data.reviewDecision || null,
			mergeable: data.mergeable || "UNKNOWN",
			checksStatus,
			checksDetail: checks,
		};
	} catch {
		return null;
	}
}

async function checkVMLiveness(
	sshHost: string,
	spikeStatus?: "running" | "completed" | "failed",
): Promise<{ reachable: boolean; spikeActuallyDone: boolean | null }> {
	const reachable = await checkSSHConnection(sshHost);

	if (!reachable) {
		return { reachable: false, spikeActuallyDone: null };
	}

	if (spikeStatus === "running") {
		try {
			const result = await sshExec(
				sshHost,
				"test -f ~/spike-done && echo done || echo running",
				{ timeoutMs: 10_000 },
			);
			return {
				reachable: true,
				spikeActuallyDone: result.stdout.trim() === "done",
			};
		} catch {
			return { reachable: true, spikeActuallyDone: null };
		}
	}

	return { reachable: true, spikeActuallyDone: null };
}

function formatCost(totalUsd: number): string {
	return `$${totalUsd.toFixed(2)}`;
}

function formatReviewDecision(decision: PRStatus["reviewDecision"]): string {
	switch (decision) {
		case "APPROVED":
			return "approved";
		case "CHANGES_REQUESTED":
			return "changes requested";
		case "REVIEW_REQUIRED":
			return "review required";
		default:
			return "no reviews";
	}
}

export const statusCommand = new Command()
	.name("status")
	.description("Dashboard view of VMs, spikes, and PR status")
	.option("--json", "Output as JSON")
	.option("--project <name>", "Filter to a specific project")
	.action(async (options: StatusOptions) => {
		try {
			const vms = options.project
				? await listVMsByProject(options.project)
				: await listVMs();

			if (vms.length === 0) {
				if (options.json) {
					const result: StatusResult = {
						timestamp: new Date().toISOString(),
						project: options.project || null,
						vms: [],
					};
					console.log(JSON.stringify(result, null, 2));
				} else {
					log.blank();
					log.info("No VMs found.");
					log.blank();
				}
				return;
			}

			// Build project-to-repo map for plan progress lookups
			const projects = await listProjects();
			const projectRepoMap = new Map<string, string>();
			for (const p of projects) {
				projectRepoMap.set(p.name, p.github.repo);
			}

			// Run all checks in parallel
			const vmStatuses: VMStatus[] = await Promise.all(
				vms.map(async (vm) => {
					const repo = projectRepoMap.get(vm.project);
					const [prResult, livenessResult, planResult] = await Promise.all([
						vm.prUrl ? fetchPRStatus(vm.prUrl) : Promise.resolve(null),
						checkVMLiveness(vm.sshHost, vm.spikeStatus),
						vm.spikeStatus && repo
							? checkPlanProgress(vm.sshHost, repo, vm.feature)
							: Promise.resolve(null),
					]);

					// Auto-correct stale spike status
					if (
						vm.spikeStatus === "running" &&
						livenessResult.spikeActuallyDone === true
					) {
						await updateVM(vm.name, { spikeStatus: "completed" });
						vm.spikeStatus = "completed";
					}

					const spike = vm.spikeStatus
						? {
								status: vm.spikeStatus,
								iterations: vm.spikeIterations || 1,
								originalPrompt: vm.originalPrompt || null,
								cumulativeCost: vm.cumulativeCost || null,
								createdAgo: timeAgo(vm.createdAt),
								createdAt: vm.createdAt,
								spikeActuallyDone: livenessResult.spikeActuallyDone,
								planProgress: planResult,
							}
						: null;

					return {
						vmName: vm.name,
						feature: vm.feature,
						project: vm.project,
						sshHost: vm.sshHost,
						githubBranch: vm.githubBranch,
						vmReachable: livenessResult.reachable,
						spike,
						pr: prResult,
					};
				}),
			);

			const result: StatusResult = {
				timestamp: new Date().toISOString(),
				project: options.project || null,
				vms: vmStatuses,
			};

			if (options.json) {
				console.log(JSON.stringify(result, null, 2));
				return;
			}

			// Human-readable output grouped by project
			log.blank();

			const byProject = new Map<string, VMStatus[]>();

			for (const vm of vmStatuses) {
				const existing = byProject.get(vm.project) || [];
				existing.push(vm);
				byProject.set(vm.project, existing);
			}

			for (const [projectName, projectVMs] of byProject) {
				log.info(`Project: ${projectName}`);
				log.blank();

				for (const vm of projectVMs) {
					const ago = vm.spike
						? vm.spike.createdAgo
						: timeAgo(vms.find((v) => v.name === vm.vmName)?.createdAt || "");
					log.step(`  ${vm.feature} (${vm.vmName}) — ${ago}`);
					log.info(
						`    VM:     ${vm.vmReachable ? "reachable" : "unreachable"}`,
					);
					log.info(`    Branch: ${vm.githubBranch}`);

					if (vm.spike) {
						const costStr = vm.spike.cumulativeCost
							? `, ${formatCost(vm.spike.cumulativeCost.totalUsd)}`
							: "";
						log.info(
							`    Spike:  ${vm.spike.status} (${vm.spike.iterations} iteration${vm.spike.iterations === 1 ? "" : "s"}${costStr})`,
						);
						if (vm.spike.planProgress) {
							log.info(
								`    Plan:   ${vm.spike.planProgress.completed}/${vm.spike.planProgress.total} steps completed`,
							);
						}
						if (vm.spike.originalPrompt) {
							const prompt =
								vm.spike.originalPrompt.length > 60
									? `${vm.spike.originalPrompt.slice(0, 57)}...`
									: vm.spike.originalPrompt;
							log.info(`    Prompt: "${prompt}"`);
						}
					}

					if (vm.pr) {
						const reviewStr = formatReviewDecision(vm.pr.reviewDecision);
						const mergeStr =
							vm.pr.mergeable === "CONFLICTING"
								? ", conflicts"
								: vm.pr.mergeable === "MERGEABLE"
									? ", mergeable"
									: "";
						log.info(
							`    PR:     #${vm.pr.number} ${vm.pr.state} — ${reviewStr}, checks ${vm.pr.checksStatus}${mergeStr}`,
						);
						log.info(`            ${vm.pr.url}`);
					}

					log.blank();
				}
			}
		} catch (error) {
			log.blank();
			log.error(
				`Failed to get status: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
