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
