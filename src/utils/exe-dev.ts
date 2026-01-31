import { execa } from "execa";
import { checkSSHConnection } from "./ssh.js";

export interface ExeDevAccessResult {
	available: boolean;
	error?: string;
}

export interface ExeDevVM {
	name: string;
	sshHost: string;
}

export interface ExeDevListItem {
	name: string;
	status: string;
}

/**
 * Check if exe.dev SSH access is configured and working
 */
export async function checkExeDevAccess(): Promise<ExeDevAccessResult> {
	try {
		// Try to run a simple command via exe.dev SSH
		const result = await execa(
			"ssh",
			[
				"-o",
				"StrictHostKeyChecking=accept-new",
				"-o",
				"ConnectTimeout=10",
				"-o",
				"BatchMode=yes",
				"exe.dev",
				"help",
			],
			{
				stdio: "pipe",
			},
		);

		// If we get output, the connection works
		if (result.stdout || result.stderr) {
			return { available: true };
		}

		return { available: true };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown SSH error";

		if (message.includes("Permission denied")) {
			return {
				available: false,
				error: "SSH key not authorized. Add your SSH public key to exe.dev.",
			};
		}

		if (
			message.includes("Could not resolve hostname") ||
			message.includes("Connection refused")
		) {
			return {
				available: false,
				error: "Cannot connect to exe.dev. Check your network connection.",
			};
		}

		return {
			available: false,
			error: `SSH connection failed: ${message}`,
		};
	}
}

/**
 * Create a new exe.dev VM
 * Returns the VM name and SSH host
 */
export async function exeDevNew(): Promise<ExeDevVM> {
	const result = await execa(
		"ssh",
		[
			"-o",
			"StrictHostKeyChecking=accept-new",
			"-o",
			"ConnectTimeout=30",
			"exe.dev",
			"new",
			"--json",
		],
		{
			stdio: "pipe",
		},
	);

	// Parse JSON response from exe.dev
	// Format: {"vm_name":"fortune-sprite","ssh_dest":"fortune-sprite.exe.xyz",...}
	const output = result.stdout.trim();

	try {
		const parsed = JSON.parse(output);
		const vmName = parsed.vm_name || parsed.name;
		const sshHost = parsed.ssh_dest || `${vmName}.exe.xyz`;

		if (!vmName) {
			throw new Error("Missing vm_name in response");
		}

		return { name: vmName, sshHost };
	} catch (parseError) {
		// If not JSON, try to extract name from text output
		const match = output.match(
			/(?:vm_name|name|VM)[:\s]+["']?([a-z]+-[a-z]+)["']?/i,
		);
		if (match) {
			const vmName = match[1];
			return { name: vmName, sshHost: `${vmName}.exe.xyz` };
		}

		throw new Error(`Failed to parse VM name from exe.dev output: ${output}`);
	}
}

/**
 * List all exe.dev VMs
 */
export async function exeDevList(): Promise<ExeDevListItem[]> {
	const result = await execa(
		"ssh",
		[
			"-o",
			"StrictHostKeyChecking=accept-new",
			"-o",
			"ConnectTimeout=10",
			"exe.dev",
			"list",
		],
		{
			stdio: "pipe",
		},
	);

	const output = result.stdout.trim();
	const vms: ExeDevListItem[] = [];

	// Parse output - format varies, try to handle common patterns
	const lines = output.split("\n").filter((line) => line.trim());

	for (const line of lines) {
		// Skip header lines
		if (
			line.toLowerCase().includes("name") &&
			line.toLowerCase().includes("status")
		) {
			continue;
		}

		// Try to extract VM name and status
		const parts = line.trim().split(/\s+/);
		if (parts.length >= 1) {
			const name = parts[0];
			// Skip if it looks like a header or separator
			if (name.startsWith("-") || name.startsWith("=")) {
				continue;
			}
			vms.push({
				name,
				status: parts[1] || "unknown",
			});
		}
	}

	return vms;
}

/**
 * Delete an exe.dev VM
 */
export async function exeDevRm(vmName: string): Promise<void> {
	await execa(
		"ssh",
		[
			"-o",
			"StrictHostKeyChecking=accept-new",
			"-o",
			"ConnectTimeout=10",
			"exe.dev",
			"rm",
			vmName,
		],
		{
			stdio: "pipe",
		},
	);
}

/**
 * Configure the port that exe.dev proxy forwards to
 * @param vmName The VM name
 * @param port The port to forward to (e.g., 3000 for Next.js)
 */
export async function exeDevSharePort(
	vmName: string,
	port: number,
): Promise<void> {
	await execa(
		"ssh",
		[
			"-o",
			"StrictHostKeyChecking=accept-new",
			"-o",
			"ConnectTimeout=10",
			"exe.dev",
			"share",
			"port",
			vmName,
			String(port),
		],
		{
			stdio: "pipe",
		},
	);
}

/**
 * Make a VM's HTTP proxy publicly accessible (no auth required)
 * @param vmName The VM name
 */
export async function exeDevSetPublic(vmName: string): Promise<void> {
	await execa(
		"ssh",
		[
			"-o",
			"StrictHostKeyChecking=accept-new",
			"-o",
			"ConnectTimeout=10",
			"exe.dev",
			"share",
			"set-public",
			vmName,
		],
		{
			stdio: "pipe",
		},
	);
}

/**
 * Wait for a VM to be ready (SSH accessible)
 * @param sshHost The SSH host to connect to
 * @param timeoutMs Maximum time to wait (default 120 seconds)
 * @param intervalMs Time between checks (default 3 seconds)
 */
export async function waitForVMReady(
	sshHost: string,
	timeoutMs = 120000,
	intervalMs = 3000,
): Promise<void> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		const isReady = await checkSSHConnection(sshHost);
		if (isReady) {
			return;
		}

		// Wait before next check
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	throw new Error(`VM ${sshHost} did not become ready within ${timeoutMs}ms`);
}
