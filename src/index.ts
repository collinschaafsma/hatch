#!/usr/bin/env node
import { Command } from "commander";
import { configCommand } from "./commands/config.js";
import { createCommand } from "./commands/create.js";

const program = new Command()
	.name("create-hatch")
	.description("Scaffold a production-ready Turborepo monorepo")
	.version("0.1.0");

program.addCommand(createCommand);
program.addCommand(configCommand);

// If no command is specified, default to create
if (process.argv.length === 2) {
	program.help();
}

program.parse();
