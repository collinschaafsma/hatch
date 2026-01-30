import { execa } from "execa";

export interface SSHExecResult {
	stdout: string;
	stderr: string;
}

export interface SSHExecOptions {
	timeoutMs?: number;
}

/**
 * Execute a command on a remote host via SSH
 * @param host SSH host to connect to
 * @param command Command to execute
 * @param options Optional settings (timeoutMs defaults to 60000)
 */
export async function sshExec(
	host: string,
	command: string,
	options?: SSHExecOptions,
): Promise<SSHExecResult> {
	const timeoutMs = options?.timeoutMs ?? 60000;

	const result = await execa(
		"ssh",
		[
			"-o",
			"StrictHostKeyChecking=accept-new",
			"-o",
			"ConnectTimeout=10",
			"-o",
			"ServerAliveInterval=30",
			"-o",
			"ServerAliveCountMax=10",
			host,
			command,
		],
		{
			stdio: "pipe",
			timeout: timeoutMs,
		},
	);

	return {
		stdout: typeof result.stdout === "string" ? result.stdout : "",
		stderr: typeof result.stderr === "string" ? result.stderr : "",
	};
}

/**
 * Copy a local file to a remote host via SCP
 */
export async function scpToRemote(
	localPath: string,
	host: string,
	remotePath: string,
): Promise<void> {
	await execa(
		"scp",
		[
			"-o",
			"StrictHostKeyChecking=accept-new",
			"-o",
			"ConnectTimeout=10",
			localPath,
			`${host}:${remotePath}`,
		],
		{
			stdio: "pipe",
		},
	);
}

/**
 * Check if SSH connection to a host is possible
 */
export async function checkSSHConnection(host: string): Promise<boolean> {
	try {
		await execa(
			"ssh",
			[
				"-o",
				"StrictHostKeyChecking=accept-new",
				"-o",
				"ConnectTimeout=5",
				"-o",
				"BatchMode=yes",
				host,
				"echo ok",
			],
			{
				stdio: "pipe",
			},
		);
		return true;
	} catch {
		return false;
	}
}
