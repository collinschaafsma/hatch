import { select } from "@inquirer/prompts";
import { Command } from "commander";
import type { VMRecord } from "../../types/index.js";
import { log } from "../../utils/logger.js";
import { createSpinner } from "../../utils/spinner.js";
import { sshExec } from "../../utils/ssh.js";
import { getVM, listVMs, updateVM } from "../../utils/vm-store.js";

interface VMFeatureOptions {
	vm?: string;
}

export const vmFeatureCommand = new Command()
	.name("feature")
	.description(
		"Create a feature branch with isolated Supabase db branches on a VM",
	)
	.argument("<feature-name>", "Name of the feature branch to create")
	.option("--vm <name>", "VM name to use (prompts if not specified)")
	.action(async (featureName: string, options: VMFeatureOptions) => {
		try {
			log.blank();
			log.info(`Creating feature branch: ${featureName}`);
			log.blank();

			// Get or select VM
			let vmRecord: VMRecord | undefined;

			if (options.vm) {
				vmRecord = await getVM(options.vm);
				if (!vmRecord) {
					log.error(`VM not found: ${options.vm}`);
					log.info("Run 'hatch vm:list' to see available VMs.");
					process.exit(1);
				}
			} else {
				// List VMs and prompt for selection
				const vms = await listVMs();

				if (vms.length === 0) {
					log.error("No VMs found.");
					log.info("Run 'hatch vm:new <project-name>' to create a VM first.");
					process.exit(1);
				}

				if (vms.length === 1) {
					vmRecord = vms[0];
					log.info(`Using VM: ${vmRecord.name}`);
				} else {
					const vmName = await select({
						message: "Select a VM:",
						choices: vms.map((vm) => ({
							value: vm.name,
							name: `${vm.name} (${vm.project})${vm.feature ? ` [feature: ${vm.feature}]` : ""}`,
						})),
					});
					vmRecord = vms.find((v) => v.name === vmName);
				}
			}

			if (!vmRecord) {
				log.error("No VM selected.");
				process.exit(1);
			}

			const { sshHost, project } = vmRecord;
			const projectPath = `~/${project}`;

			// Step 1: Create git branch from origin/main
			const gitSpinner = createSpinner("Creating git branch").start();
			try {
				// Fetch latest and create branch from origin/main
				await sshExec(
					sshHost,
					`cd ${projectPath} && git fetch origin && git checkout -b ${featureName} origin/main`,
				);
				gitSpinner.succeed(`Git branch created: ${featureName}`);
			} catch (error) {
				gitSpinner.fail("Failed to create git branch");
				throw error;
			}

			// Step 2: Create Supabase branches (main and test)
			const mainBranch = featureName;
			const testBranch = `${featureName}-test`;

			const supabaseSpinner = createSpinner(
				"Creating Supabase branches",
			).start();
			try {
				// Create main feature branch (persistent)
				await sshExec(
					sshHost,
					`cd ${projectPath} && supabase branches create ${mainBranch} --persistent`,
				);

				// Create test branch (persistent)
				await sshExec(
					sshHost,
					`cd ${projectPath} && supabase branches create ${testBranch} --persistent`,
				);

				supabaseSpinner.succeed(
					`Supabase branches created: ${mainBranch}, ${testBranch}`,
				);
			} catch (error) {
				supabaseSpinner.fail("Failed to create Supabase branches");
				throw error;
			}

			// Step 3: Wait for branches to provision and get credentials
			const credSpinner = createSpinner(
				"Waiting for Supabase branches to provision",
			).start();
			try {
				// Wait a bit for branches to be ready
				await new Promise((resolve) => setTimeout(resolve, 30000));

				// Get branch credentials and update .env.local
				// The supabase CLI provides a way to get the database URL
				const { stdout } = await sshExec(
					sshHost,
					`cd ${projectPath} && supabase branches get ${mainBranch} --output json 2>/dev/null || echo '{}'`,
				);

				// Try to parse and extract DATABASE_URL
				try {
					const branchInfo = JSON.parse(stdout);
					if (branchInfo.db_url) {
						// Update .env.local with the new DATABASE_URL
						await sshExec(
							sshHost,
							`cd ${projectPath}/apps/web && sed -i 's|^DATABASE_URL=.*|DATABASE_URL=${branchInfo.db_url}|' .env.local`,
						);
						credSpinner.succeed("Branch credentials configured");
					} else {
						credSpinner.warn(
							"Could not get branch credentials automatically. You may need to update .env.local manually.",
						);
					}
				} catch {
					credSpinner.warn(
						"Could not parse branch info. You may need to update .env.local manually.",
					);
				}
			} catch (error) {
				credSpinner.warn(
					"Could not configure branch credentials automatically. You may need to update .env.local manually.",
				);
			}

			// Step 4: Push branch to origin
			const pushSpinner = createSpinner("Pushing branch to origin").start();
			try {
				await sshExec(
					sshHost,
					`cd ${projectPath} && git push -u origin ${featureName}`,
				);
				pushSpinner.succeed("Branch pushed to origin");
			} catch (error) {
				pushSpinner.fail("Failed to push branch");
				throw error;
			}

			// Step 5: Update local VM tracking
			await updateVM(vmRecord.name, {
				feature: featureName,
				githubBranch: featureName,
				supabaseBranches: [mainBranch, testBranch],
			});

			// Print summary
			log.blank();
			log.success("Feature branch created successfully!");
			log.blank();
			log.info("Feature details:");
			log.step(`VM:              ${vmRecord.name}`);
			log.step(`Git branch:      ${featureName}`);
			log.step(`Supabase branch: ${mainBranch}`);
			log.step(`Test branch:     ${testBranch}`);
			log.blank();
			log.info("To start working on the feature:");
			log.step(`ssh ${sshHost}`);
			log.step(`cd ~/${project} && claude`);
			log.blank();
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("User force closed")
			) {
				log.blank();
				log.info("Operation cancelled.");
				process.exit(0);
			}
			log.blank();
			log.error(
				`Failed to create feature: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});
