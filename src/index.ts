#!/usr/bin/env node
import { Command } from "commander";
import { addCommand } from "./commands/add.js";
import { cleanCommand } from "./commands/clean.js";
import { configCommand } from "./commands/config.js";
import { connectCommand } from "./commands/connect.js";
import { createCommand } from "./commands/create.js";
import { featureCommand } from "./commands/feature.js";
import { listCommand } from "./commands/list.js";
import { newCommand } from "./commands/new.js";

const program = new Command()
	.name("hatch")
	.description("Create and manage projects with ephemeral exe.dev VMs")
	.version("0.1.0");

program.addCommand(newCommand);
program.addCommand(featureCommand);
program.addCommand(addCommand);
program.addCommand(connectCommand);
program.addCommand(listCommand);
program.addCommand(cleanCommand);
program.addCommand(configCommand);
program.addCommand(createCommand);

// If no command is specified, default to help
if (process.argv.length === 2) {
	program.help();
}

program.parse();
