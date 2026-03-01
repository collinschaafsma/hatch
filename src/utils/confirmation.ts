import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { log } from "./logger.js";

const STORE_PATH = path.join(
	os.homedir(),
	".hatch",
	"pending-confirmations.json",
);

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_AGE_MS = 10 * 1000; // 10 seconds

interface PendingConfirmation {
	token: string;
	createdAt: string;
	expiresAt: string;
	command: string;
	summary: string;
	prompt?: string;
}

interface ConfirmationStore {
	version: 1;
	confirmations: Record<string, PendingConfirmation>;
}

export interface ConfirmationGateOptions {
	command: string;
	args: Record<string, string>;
	summary: string;
	details: () => void;
	dryRun?: boolean;
	confirmToken?: string;
	force?: boolean;
	prompt?: string;
}

export function generateToken(): string {
	return crypto.randomBytes(4).toString("hex");
}

export function computeCommandHash(
	command: string,
	args: Record<string, string>,
): string {
	const sorted = Object.keys(args)
		.sort()
		.map((k) => `${k}=${args[k]}`)
		.join("&");
	const input = `${command}:${sorted}`;
	return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

async function loadStore(): Promise<ConfirmationStore> {
	if (await fs.pathExists(STORE_PATH)) {
		try {
			const data = await fs.readJson(STORE_PATH);
			if (data.version === 1 && data.confirmations) {
				// Prune expired entries
				const now = Date.now();
				for (const [key, entry] of Object.entries(data.confirmations)) {
					const conf = entry as PendingConfirmation;
					if (new Date(conf.expiresAt).getTime() <= now) {
						delete data.confirmations[key];
					}
				}
				return data as ConfirmationStore;
			}
		} catch {
			// Corrupted file, return empty store
		}
	}
	return { version: 1, confirmations: {} };
}

async function saveStore(store: ConfirmationStore): Promise<void> {
	await fs.ensureDir(path.dirname(STORE_PATH));
	await fs.writeJson(STORE_PATH, store, { spaces: 2 });
}

export async function storeConfirmation(opts: {
	command: string;
	args: Record<string, string>;
	summary: string;
	prompt?: string;
}): Promise<{ token: string }> {
	const store = await loadStore();
	const hash = computeCommandHash(opts.command, opts.args);
	const token = generateToken();

	store.confirmations[hash] = {
		token,
		createdAt: new Date(Date.now()).toISOString(),
		expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
		command: opts.command,
		summary: opts.summary,
		...(opts.prompt && { prompt: opts.prompt }),
	};

	await saveStore(store);
	return { token };
}

export async function validateAndConsumeToken(opts: {
	command: string;
	args: Record<string, string>;
	token: string;
}): Promise<PendingConfirmation | "too_young" | null> {
	const store = await loadStore();
	const hash = computeCommandHash(opts.command, opts.args);
	const entry = store.confirmations[hash];

	if (!entry) {
		return null;
	}

	if (new Date(entry.expiresAt).getTime() <= Date.now()) {
		delete store.confirmations[hash];
		await saveStore(store);
		return null;
	}

	if (entry.token !== opts.token) {
		return null;
	}

	// Enforce minimum age to prevent automated agents from bypassing human review
	if (Date.now() - new Date(entry.createdAt).getTime() < MIN_AGE_MS) {
		return "too_young";
	}

	// Consume the token
	delete store.confirmations[hash];
	await saveStore(store);
	return entry;
}

export async function requireConfirmation(
	opts: ConfirmationGateOptions,
): Promise<{ storedPrompt?: string }> {
	const { command, args, summary, details, dryRun, confirmToken, force } = opts;

	if (force) {
		if (!process.stdin.isTTY) {
			log.error("--force requires an interactive terminal.");
			process.exit(1);
		}
		return {};
	}

	if (confirmToken) {
		const entry = await validateAndConsumeToken({
			command,
			args,
			token: confirmToken,
		});
		if (entry === "too_young") {
			log.error(
				"Confirmation token must be at least 10 seconds old. This prevents automated agents from bypassing human review. Please wait and try again.",
			);
			process.exit(1);
		}
		if (!entry) {
			log.error("Invalid or expired confirmation token.");
			log.info("Run with --dry-run to get a new token.");
			process.exit(1);
		}
		return { storedPrompt: entry.prompt };
	}

	if (dryRun) {
		details();
		const { token } = await storeConfirmation({
			command,
			args,
			summary,
			prompt: opts.prompt,
		});
		log.blank();
		log.info(`Confirmation token: ${token}`);
		log.info("Token expires in 5 minutes.");
		log.blank();

		// Build the confirm command hint
		const argParts = Object.entries(args)
			.map(([k, v]) => `--${k} ${v}`)
			.join(" ");
		log.info("To confirm, run:");
		log.step(`hatch ${command} ${argParts} --confirm ${token}`);
		log.blank();
		process.exit(0);
	}

	// No flags provided
	log.error(
		"This command requires confirmation. Run with --dry-run first to review.",
	);
	process.exit(1);
}
