import { Command } from "commander";
import { vmAddCommand } from "./add.js";
import { vmCleanCommand } from "./clean.js";
import { vmConnectCommand } from "./connect.js";
import { vmFeatureCommand } from "./feature.js";
import { vmListCommand } from "./list.js";
import { vmNewCommand } from "./new.js";
import { vmSetupCommand } from "./setup.js";

export const vmCommand = new Command()
	.name("vm")
	.description("Manage exe.dev VMs for development")
	.addCommand(vmNewCommand)
	.addCommand(vmAddCommand)
	.addCommand(vmSetupCommand)
	.addCommand(vmFeatureCommand)
	.addCommand(vmConnectCommand)
	.addCommand(vmCleanCommand)
	.addCommand(vmListCommand);
