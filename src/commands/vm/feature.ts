import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import fs from "fs-extra";
import type { VMRecord } from "../../types/index.js";
import {
	checkExeDevAccess,
	exeDevNew,
	exeDevRm,
	waitForVMReady,
} from "../../utils/exe-dev.js";
import { log } from "../../utils/logger.js";
import { getProject } from "../../utils/project-store.js";
import { createSpinner } from "../../utils/spinner.js";
import { scpToRemote, sshExec } from "../../utils/ssh.js";
import { addVM } from "../../utils/vm-store.js";

interface VMFeatureOptions {
	project: string;
	config?: string;
}

export const vmFeatureCommand = new Command()
	.name("feature")
	.description(
		"Create a new VM for feature development with isolated Supabase branches",
	)
	.argument("<feature-name>", "Name of the feature branch to create")
	.requiredOption("--project <name>", "Project name (from hatch vm new)")
	.option(
		"-c, --config <path>",
		"Path to hatch.json config file",
		path.join(os.homedir(), ".hatch.json"),
	)
	.action(async (featureName: string, options: VMFeatureOptions) => {
		let vmName: string | undefined;
		let sshHost: string | undefined;

		try {
			log.blank();
			log.info(`Creating feature VM: ${featureName}`);
			log.info(`Project: ${options.project}`);
			log.blank();

			// Step 1: Look up project
			const project = await getProject(options.project);
			if (!project) {
				log.error(`Project not found: ${options.project}`);
				log.info("Run 'hatch vm list --projects' to see available projects.");
				log.info("Run 'hatch vm new <project-name>' to create a new project.");
				process.exit(1);
			}

			// Step 2: Check exe.dev access
			const accessSpinner = createSpinner(
				"Checking exe.dev SSH access",
			).start();
			const access = await checkExeDevAccess();

			if (!access.available) {
				accessSpinner.fail("Cannot connect to exe.dev");
				log.blank();
				log.error(access.error || "Unknown error");
				process.exit(1);
			}
			accessSpinner.succeed("exe.dev SSH access confirmed");

			// Check config file exists
			const configPath =
				options.config || path.join(os.homedir(), ".hatch.json");
			if (!(await fs.pathExists(configPath))) {
				log.blank();
				log.error(`Config file not found: ${configPath}`);
				log.info("Run 'hatch config --global' to create a config file.");
				log.blank();
				process.exit(1);
			}

			// Step 3: Create new VM
			const vmSpinner = createSpinner("Creating exe.dev VM").start();
			const vm = await exeDevNew();
			vmName = vm.name;
			sshHost = vm.sshHost;
			vmSpinner.succeed(`VM created: ${vmName}`);

			// Step 4: Wait for VM to be ready
			const readySpinner = createSpinner(
				`Waiting for VM to be ready (${sshHost})`,
			).start();
			await waitForVMReady(sshHost, 120000);
			readySpinner.succeed("VM is ready");

			// Step 5: Copy config file to VM
			const configSpinner = createSpinner("Copying config file to VM").start();
			await scpToRemote(configPath, sshHost, "~/.hatch.json");
			configSpinner.succeed("Config file copied");

			// Step 6: Run feature install script
			const installSpinner = createSpinner(
				"Setting up feature VM (installing CLIs, cloning repo)",
			).start();

			const installCommand = `curl -fsSL https://raw.githubusercontent.com/collinschaafsma/hatch/main/scripts/feature-install.sh | bash -s -- ${project.github.url} --config ~/.hatch.json`;

			try {
				await sshExec(sshHost, installCommand, {
					timeoutMs: 10 * 60 * 1000,
				});
				installSpinner.succeed("Feature VM setup complete");
			} catch (error) {
				installSpinner.fail("Failed to set up feature VM");
				if (error instanceof Error && "stderr" in error) {
					const stderr = (error as { stderr?: string }).stderr;
					if (stderr) {
						log.error("Install script output:");
						console.log(stderr.slice(-2000));
					}
				}
				throw error;
			}

			const projectPath = `~/${project.github.repo}`;

			// Step 7: Create git branch from origin/main
			const gitSpinner = createSpinner("Creating git branch").start();
			try {
				await sshExec(
					sshHost,
					`cd ${projectPath} && git fetch origin && git checkout -b ${featureName} origin/main`,
				);
				gitSpinner.succeed(`Git branch created: ${featureName}`);
			} catch (error) {
				gitSpinner.fail("Failed to create git branch");
				throw error;
			}

			// Step 8: Create Supabase branches (main and test)
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

			// Step 9: Wait for branches to provision and get credentials
			const credSpinner = createSpinner(
				"Waiting for Supabase branches to provision",
			).start();
			try {
				// Wait a bit for branches to be ready
				await new Promise((resolve) => setTimeout(resolve, 30000));

				// Get branch credentials and update .env.local
				const { stdout } = await sshExec(
					sshHost,
					`cd ${projectPath} && supabase branches get ${mainBranch} --output json 2>/dev/null || echo '{}'`,
				);

				try {
					const branchInfo = JSON.parse(stdout);
					if (branchInfo.db_url) {
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
			} catch {
				credSpinner.warn(
					"Could not configure branch credentials automatically. You may need to update .env.local manually.",
				);
			}

			// Step 10: Push branch to origin
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

			// Step 11: Save VM to local tracking
			const vmRecord: VMRecord = {
				name: vmName,
				sshHost,
				project: project.name,
				feature: featureName,
				createdAt: new Date().toISOString(),
				supabaseBranches: [mainBranch, testBranch],
				githubBranch: featureName,
			};
			await addVM(vmRecord);

			// Print summary
			log.blank();
			log.success("Feature VM created successfully!");
			log.blank();
			log.info("Feature details:");
			log.step(`VM:              ${vmName}`);
			log.step(`Project:         ${project.name}`);
			log.step(`Git branch:      ${featureName}`);
			log.step(`Supabase branch: ${mainBranch}`);
			log.step(`Test branch:     ${testBranch}`);
			log.blank();
			log.info("Connect:");
			log.step(`SSH:     ssh ${sshHost}`);
			log.step(
				`VS Code: vscode://vscode-remote/ssh-remote+${sshHost}/home/exedev/${project.github.repo}`,
			);
			log.step(
				`Web:     https://${vmName}.exe.xyz (once app runs on port 3000)`,
			);
			log.blank();
			log.info("To start working:");
			log.step(`ssh ${sshHost}`);
			log.step(`cd ~/${project.github.repo} && claude`);
			log.blank();
			log.info("When done:");
			log.step(`hatch vm clean ${featureName} --project ${project.name}`);
			log.blank();
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("User force closed")
			) {
				log.blank();
				log.info("Operation cancelled.");
			} else {
				log.blank();
				log.error(
					`Failed to create feature VM: ${error instanceof Error ? error.message : error}`,
				);
			}

			// Rollback: delete VM if it was created
			if (vmName) {
				log.info("Rolling back: deleting VM...");
				try {
					await exeDevRm(vmName);
					log.success("VM deleted");
				} catch (rollbackError) {
					log.warn(
						`Failed to delete VM ${vmName}. Delete manually with: ssh exe.dev rm ${vmName}`,
					);
				}
			}

			process.exit(1);
		}
	});
