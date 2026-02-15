import prompts from "prompts";
import validatePackageName from "validate-npm-package-name";

export interface ProjectOptions {
	projectName: string;
}

function validateProjectName(name: string): boolean | string {
	const result = validatePackageName(name);
	if (result.validForNewPackages) {
		return true;
	}
	const errors = [...(result.errors || []), ...(result.warnings || [])];
	return errors[0] || "Invalid project name";
}

export async function getProjectPrompts(
	initialName?: string,
): Promise<ProjectOptions> {
	const response = await prompts(
		[
			{
				type: initialName ? null : "text",
				name: "projectName",
				message: "What is your project name?",
				initial: "my-app",
				validate: validateProjectName,
			},
		],
		{
			onCancel: () => {
				console.log("\nOperation cancelled.");
				process.exit(0);
			},
		},
	);

	return {
		projectName: initialName || response.projectName,
	};
}
