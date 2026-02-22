import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import fs from "fs-extra";
import { getProjectConfigPath } from "../utils/config-resolver.js";
import { log } from "../utils/logger.js";
import { getProject } from "../utils/project-store.js";
import { createSpinner } from "../utils/spinner.js";
import { checkSSHConnection, scpToRemote, sshExec } from "../utils/ssh.js";

export const configPushCommand = new Command()
	.name("config-push")
	.description(
		"Push config to a remote server. Use --project to sync a project's config and record.",
	)
	.argument("<ssh-host>", "SSH host to push config to")
	.option("-c, --config <path>", "Path to local config file")
	.option(
		"--project <name>",
		"Sync a specific project (config + project record)",
	)
	.action(
		async (sshHost: string, options: { config?: string; project?: string }) => {
			try {
				log.blank();

				if (options.project) {
					await pushProject(sshHost, options.project);
				} else {
					await pushGlobalConfig(sshHost, options.config);
				}
			} catch (error) {
				log.blank();
				log.error(
					`Failed to push config: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		},
	);

/**
 * Original behavior: push global config to ~/.hatch.json on remote
 */
async function pushGlobalConfig(
	sshHost: string,
	configPath?: string,
): Promise<void> {
	const resolvedPath = configPath ?? (await findGlobalConfig());

	if (!(await fs.pathExists(resolvedPath))) {
		log.error(`Config file not found: ${resolvedPath}`);
		log.info('Run "hatch config" to generate it.');
		process.exit(1);
	}

	log.info(`Pushing config to ${sshHost}...`);
	log.blank();

	const sshSpinner = createSpinner("Checking SSH connection").start();
	const connected = await checkSSHConnection(sshHost);
	if (!connected) {
		sshSpinner.fail("Cannot connect to host");
		log.error(`SSH connection to ${sshHost} failed.`);
		process.exit(1);
	}
	sshSpinner.succeed("SSH connection OK");

	const scpSpinner = createSpinner("Copying config file").start();
	try {
		await scpToRemote(resolvedPath, sshHost, "~/.hatch.json");
		scpSpinner.succeed("Config file copied");
	} catch (error) {
		scpSpinner.fail("Failed to copy config file");
		throw error;
	}

	log.blank();
	log.success(`Config pushed to ${sshHost}:~/.hatch.json`);
	log.blank();
}

/**
 * Find the global config path (current dir hatch.json or ~/.hatch.json)
 */
async function findGlobalConfig(): Promise<string> {
	const cwdConfig = path.join(process.cwd(), "hatch.json");
	if (await fs.pathExists(cwdConfig)) {
		return cwdConfig;
	}
	return path.join(os.homedir(), ".hatch.json");
}

/**
 * Push a specific project's config and record to the remote
 */
async function pushProject(
	sshHost: string,
	projectName: string,
): Promise<void> {
	// Step 1: Validate locally
	const project = await getProject(projectName);
	if (!project) {
		log.error(`Project "${projectName}" not found locally.`);
		log.info('Run "hatch add <project>" to register it first.');
		process.exit(1);
	}

	const localConfigPath = await getProjectConfigPath(projectName);
	const hasConfig = await fs.pathExists(localConfigPath);
	if (!hasConfig) {
		log.warn(
			`No per-project config found at ${localConfigPath} — syncing project record only.`,
		);
	}

	log.info(`Syncing project "${projectName}" to ${sshHost}...`);
	log.blank();

	// Step 2: Check SSH connection
	const sshSpinner = createSpinner("Checking SSH connection").start();
	const connected = await checkSSHConnection(sshHost);
	if (!connected) {
		sshSpinner.fail("Cannot connect to host");
		log.error(`SSH connection to ${sshHost} failed.`);
		process.exit(1);
	}
	sshSpinner.succeed("SSH connection OK");

	// Step 3: Back up remote configs
	const backupSpinner = createSpinner("Backing up remote configs").start();
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	try {
		await sshExec(
			sshHost,
			`mkdir -p ~/.hatch/backups && cp ~/.hatch/projects.json ~/.hatch/backups/projects.json.${timestamp} 2>/dev/null; cp ~/.hatch/configs/${projectName}.json ~/.hatch/backups/${projectName}.json.${timestamp} 2>/dev/null; true`,
		);
		backupSpinner.succeed(
			`Backed up remote configs to ~/.hatch/backups/ (${timestamp})`,
		);
	} catch {
		backupSpinner.warn("Could not back up remote configs (may not exist yet)");
	}

	// Step 4: Push per-project config
	if (hasConfig) {
		const configSpinner = createSpinner("Pushing project config").start();
		try {
			await sshExec(sshHost, "mkdir -p ~/.hatch/configs");
			await scpToRemote(
				localConfigPath,
				sshHost,
				`~/.hatch/configs/${projectName}.json`,
			);
			configSpinner.succeed("Project config pushed");
		} catch (error) {
			configSpinner.fail("Failed to push project config");
			throw error;
		}
	}

	// Step 5: Merge project record into remote projects.json
	const mergeSpinner = createSpinner("Merging project record").start();
	try {
		// Read remote projects.json
		const { stdout: remoteJson } = await sshExec(
			sshHost,
			'cat ~/.hatch/projects.json 2>/dev/null || echo \'{"version":1,"projects":[]}\'',
		);

		let remoteStore: { version: number; projects: Array<{ name: string }> };
		try {
			remoteStore = JSON.parse(remoteJson);
		} catch {
			remoteStore = { version: 1, projects: [] };
		}

		// Ensure valid structure
		if (!Array.isArray(remoteStore.projects)) {
			remoteStore = { version: 1, projects: [] };
		}

		// Merge: replace existing or append
		const existingIndex = remoteStore.projects.findIndex(
			(p) => p.name === projectName,
		);
		const action = existingIndex >= 0 ? "updated" : "added";
		if (existingIndex >= 0) {
			remoteStore.projects[existingIndex] = project;
		} else {
			remoteStore.projects.push(project);
		}

		// Write merged store to temp file and SCP it
		const tmpFile = path.join(os.tmpdir(), `hatch-projects-${Date.now()}.json`);
		await fs.writeJson(tmpFile, remoteStore, { spaces: 2 });
		try {
			await sshExec(sshHost, "mkdir -p ~/.hatch");
			await scpToRemote(tmpFile, sshHost, "~/.hatch/projects.json");
		} finally {
			await fs.remove(tmpFile);
		}

		mergeSpinner.succeed(`Project record ${action} in remote projects.json`);
	} catch (error) {
		mergeSpinner.fail("Failed to merge project record");
		throw error;
	}

	// Step 6: Summary
	log.blank();
	log.success(`Project "${projectName}" synced to ${sshHost}`);
	if (hasConfig) {
		log.step(`  Config: ~/.hatch/configs/${projectName}.json`);
	}
	log.step("  Record: ~/.hatch/projects.json");
	log.blank();
}
