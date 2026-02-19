#!/usr/bin/env node
import { Command } from "commander";
import { addCommand } from "./commands/add.js";
import { cleanCommand } from "./commands/clean.js";
import { configPushCommand } from "./commands/config-push.js";
import { configCommand } from "./commands/config.js";
import { connectCommand } from "./commands/connect.js";
import { createCommand } from "./commands/create.js";
import { destroyCommand } from "./commands/destroy.js";
import { featureCommand } from "./commands/feature.js";
import { hardenCommand } from "./commands/harden.js";
import { listCommand } from "./commands/list.js";
import { newCommand } from "./commands/new.js";
import { progressCommand } from "./commands/progress.js";
import { setPreviewDeployKeyCommand } from "./commands/set-preview-deploy-key.js";
import { spikeCommand } from "./commands/spike.js";
import { statusCommand } from "./commands/status.js";
import { updateCommand } from "./commands/update.js";

const program = new Command()
	.name("hatch")
	.description("Create and manage projects with ephemeral exe.dev VMs")
	.version("0.1.0");

program.addCommand(newCommand);
program.addCommand(featureCommand);
program.addCommand(spikeCommand);
program.addCommand(addCommand);
program.addCommand(connectCommand);
program.addCommand(listCommand);
program.addCommand(cleanCommand);
program.addCommand(configCommand);
program.addCommand(configPushCommand);
program.addCommand(createCommand);
program.addCommand(destroyCommand);
program.addCommand(hardenCommand);
program.addCommand(setPreviewDeployKeyCommand);
program.addCommand(progressCommand);
program.addCommand(statusCommand);
program.addCommand(updateCommand);

// If no command is specified, default to help
if (process.argv.length === 2) {
	program.help();
}

program.parse();
