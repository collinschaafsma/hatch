import { Command } from "commander";
import fs from "fs-extra";
import { resolveConfigPath } from "../utils/config-resolver.js";
import { log } from "../utils/logger.js";
import { createSpinner } from "../utils/spinner.js";
import { checkSSHConnection, scpToRemote } from "../utils/ssh.js";

export const configPushCommand = new Command()
	.name("config-push")
	.description("Push config to a remote server")
	.argument("<ssh-host>", "SSH host to push config to")
	.option("-c, --config <path>", "Path to local config file")
	.option("--project <name>", "Push a specific project's config")
	.action(
		async (sshHost: string, options: { config?: string; project?: string }) => {
			try {
				log.blank();

				const configPath = await resolveConfigPath({
					configPath: options.config,
					project: options.project,
				});

				// Check config file exists
				if (!(await fs.pathExists(configPath))) {
					log.error(`Config file not found: ${configPath}`);
					log.info('Run "hatch config" to generate it.');
					process.exit(1);
				}

				log.info(`Pushing config to ${sshHost}...`);
				log.blank();

				// Check SSH connection
				const sshSpinner = createSpinner("Checking SSH connection").start();
				const connected = await checkSSHConnection(sshHost);
				if (!connected) {
					sshSpinner.fail("Cannot connect to host");
					log.error(`SSH connection to ${sshHost} failed.`);
					process.exit(1);
				}
				sshSpinner.succeed("SSH connection OK");

				// SCP config file to remote
				const scpSpinner = createSpinner("Copying config file").start();
				try {
					await scpToRemote(configPath, sshHost, "~/.hatch.json");
					scpSpinner.succeed("Config file copied");
				} catch (error) {
					scpSpinner.fail("Failed to copy config file");
					throw error;
				}

				log.blank();
				log.success(`Config pushed to ${sshHost}:~/.hatch.json`);
				log.blank();
			} catch (error) {
				log.blank();
				log.error(
					`Failed to push config: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		},
	);
