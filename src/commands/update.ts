import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { execa } from "execa";
import fs from "fs-extra";
import { log } from "../utils/logger.js";
import { createSpinner } from "../utils/spinner.js";
import { checkSSHConnection, sshExec } from "../utils/ssh.js";

interface UpdateOptions {
	skipInstall?: boolean;
}

export const updateCommand = new Command()
	.name("update")
	.description("Update hatch CLI on a remote server or locally")
	.argument("[ssh-host]", "SSH host to connect to (omit to update locally)")
	.option("--skip-install", "Skip pnpm install if deps haven't changed")
	.action(async (sshHost: string | undefined, options: UpdateOptions) => {
		try {
			log.blank();

			if (sshHost) {
				await updateRemote(sshHost, options);
			} else {
				await updateLocal(options);
			}
		} catch (error) {
			log.blank();
			log.error(
				`Failed to update: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});

async function updateRemote(
	host: string,
	options: UpdateOptions,
): Promise<void> {
	log.info(`Updating hatch on ${host}...`);
	log.blank();

	// Check SSH connection
	const sshSpinner = createSpinner("Checking SSH connection").start();
	const connected = await checkSSHConnection(host);
	if (!connected) {
		sshSpinner.fail("Cannot connect to host");
		log.error(`SSH connection to ${host} failed.`);
		process.exit(1);
	}
	sshSpinner.succeed("SSH connection OK");

	// Pull latest changes
	const pullSpinner = createSpinner("Pulling latest changes").start();
	try {
		await sshExec(host, "cd ~/.hatch-cli && git pull");
		pullSpinner.succeed("Pulled latest changes");
	} catch (error) {
		pullSpinner.fail("Failed to pull latest changes");
		throw error;
	}

	// Install dependencies
	if (!options.skipInstall) {
		const installSpinner = createSpinner("Installing dependencies").start();
		try {
			await sshExec(host, "cd ~/.hatch-cli && pnpm install", {
				timeoutMs: 120_000,
			});
			installSpinner.succeed("Dependencies installed");
		} catch (error) {
			installSpinner.fail("Failed to install dependencies");
			throw error;
		}
	}

	// Build
	const buildSpinner = createSpinner("Building hatch").start();
	try {
		await sshExec(host, "cd ~/.hatch-cli && pnpm build", {
			timeoutMs: 120_000,
		});
		buildSpinner.succeed("Build complete");
	} catch (error) {
		buildSpinner.fail("Failed to build");
		throw error;
	}

	// Update skills
	const skillsSpinner = createSpinner("Updating skills").start();
	try {
		const result = await sshExec(
			host,
			'test -d ~/.openclaw/skills && cp -r ~/.hatch-cli/skills/hatch ~/.openclaw/skills/ && echo "updated" || echo "skipped"',
		);
		const output = result.stdout.trim();
		if (output === "updated") {
			skillsSpinner.succeed("OpenClaw skills updated");
		} else {
			skillsSpinner.succeed("OpenClaw skills directory not found, skipped");
		}
	} catch (error) {
		skillsSpinner.warn("Could not update skills");
	}

	log.blank();
	log.success(`Hatch updated on ${host}`);
	log.blank();
}

async function updateLocal(options: UpdateOptions): Promise<void> {
	const hatchDir = path.join(os.homedir(), ".hatch-cli");

	log.info("Updating local hatch installation...");
	log.blank();

	// Check hatch-cli directory exists
	if (!(await fs.pathExists(hatchDir))) {
		log.error("~/.hatch-cli not found. Is hatch installed on this machine?");
		process.exit(1);
	}

	// Pull latest changes
	const pullSpinner = createSpinner("Pulling latest changes").start();
	try {
		await execa("git", ["pull"], { cwd: hatchDir });
		pullSpinner.succeed("Pulled latest changes");
	} catch (error) {
		pullSpinner.fail("Failed to pull latest changes");
		throw error;
	}

	// Install dependencies
	if (!options.skipInstall) {
		const installSpinner = createSpinner("Installing dependencies").start();
		try {
			await execa("pnpm", ["install"], { cwd: hatchDir });
			installSpinner.succeed("Dependencies installed");
		} catch (error) {
			installSpinner.fail("Failed to install dependencies");
			throw error;
		}
	}

	// Build
	const buildSpinner = createSpinner("Building hatch").start();
	try {
		await execa("pnpm", ["build"], { cwd: hatchDir });
		buildSpinner.succeed("Build complete");
	} catch (error) {
		buildSpinner.fail("Failed to build");
		throw error;
	}

	// Update skills
	const skillsDir = path.join(os.homedir(), ".openclaw", "skills");
	const skillsSpinner = createSpinner("Updating skills").start();
	if (await fs.pathExists(skillsDir)) {
		try {
			await fs.copy(
				path.join(hatchDir, "skills", "hatch"),
				path.join(skillsDir, "hatch"),
				{ overwrite: true },
			);
			skillsSpinner.succeed("OpenClaw skills updated");
		} catch (error) {
			skillsSpinner.warn("Could not update skills");
		}
	} else {
		skillsSpinner.succeed("OpenClaw skills directory not found, skipped");
	}

	log.blank();
	log.success("Hatch updated locally");
	log.blank();
}
