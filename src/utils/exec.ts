import { type Options, execa } from "execa";

export async function execCommand(
	command: string,
	args: string[],
	options?: Options,
): Promise<{ stdout: string; stderr: string }> {
	const result = await execa(command, args, {
		stdio: "pipe",
		...options,
	});
	return {
		stdout: typeof result.stdout === "string" ? result.stdout : "",
		stderr: typeof result.stderr === "string" ? result.stderr : "",
	};
}

export async function pnpmInstall(cwd: string): Promise<void> {
	await execCommand("pnpm", ["install"], { cwd });
}

export async function pnpmAdd(
	packages: string[],
	cwd: string,
	dev = false,
): Promise<void> {
	const args = ["add", ...(dev ? ["-D"] : []), ...packages];
	await execCommand("pnpm", args, { cwd });
}

export async function pnpmExec(
	command: string,
	args: string[],
	cwd: string,
): Promise<void> {
	await execCommand("pnpm", ["exec", command, ...args], { cwd });
}

export async function pnpmRun(script: string, cwd: string): Promise<void> {
	await execCommand("pnpm", ["run", script], { cwd });
}

export async function pnpmDlx(
	command: string,
	args: string[],
	cwd: string,
): Promise<{ stdout: string; stderr: string }> {
	return await execCommand("pnpm", ["dlx", command, ...args], { cwd });
}

export async function npxCommand(
	command: string,
	args: string[],
	cwd: string,
): Promise<{ stdout: string; stderr: string }> {
	return await execCommand("npx", [command, ...args], { cwd });
}

export async function gitInit(cwd: string): Promise<void> {
	await execCommand("git", ["init"], { cwd });
}

export async function gitAdd(cwd: string, files = "."): Promise<void> {
	await execCommand("git", ["add", files], { cwd });
}

export async function gitCommit(message: string, cwd: string): Promise<void> {
	await execCommand("git", ["commit", "-m", message], { cwd });
}

function gitEnvWithToken(token?: string): {
	args: string[];
	env?: Record<string, string>;
} {
	if (!token) return { args: [] };
	return {
		args: [
			"-c",
			"credential.helper=!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f",
		],
		env: { ...process.env, GITHUB_TOKEN: token, GH_TOKEN: token } as Record<
			string,
			string
		>,
	};
}

export async function gitClone(
	url: string,
	targetDir: string,
	token?: string,
): Promise<void> {
	const { args, env } = gitEnvWithToken(token);
	await execCommand("git", [...args, "clone", url, targetDir], { env });
}

export async function gitPull(
	cwd: string,
	token?: string,
): Promise<{ stdout: string }> {
	const { args, env } = gitEnvWithToken(token);
	return await execCommand("git", [...args, "pull"], { cwd, env });
}

export async function gitCurrentBranch(cwd: string): Promise<string> {
	const { stdout } = await execCommand(
		"git",
		["rev-parse", "--abbrev-ref", "HEAD"],
		{ cwd },
	);
	return stdout.trim();
}

export async function gitCheckout(
	cwd: string,
	branch: string,
	create = false,
): Promise<void> {
	const args = create ? ["checkout", "-b", branch] : ["checkout", branch];
	await execCommand("git", args, { cwd });
}

export async function gitPush(
	cwd: string,
	branch: string,
	token?: string,
): Promise<void> {
	const { args, env } = gitEnvWithToken(token);
	await execCommand("git", [...args, "push", "-u", "origin", branch], {
		cwd,
		env,
	});
}
