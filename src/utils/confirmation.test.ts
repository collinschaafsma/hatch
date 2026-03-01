import {
	type MockInstance,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

vi.mock("fs-extra", () => ({
	default: {
		pathExists: vi.fn(),
		readJson: vi.fn(),
		writeJson: vi.fn(),
		ensureDir: vi.fn(),
	},
}));

vi.mock("./logger.js", () => ({
	log: {
		info: vi.fn(),
		success: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		step: vi.fn(),
		blank: vi.fn(),
	},
}));

import fs from "fs-extra";
import {
	computeCommandHash,
	generateToken,
	requireConfirmation,
	storeConfirmation,
	validateAndConsumeToken,
} from "./confirmation.js";
import { log } from "./logger.js";

const mockFs = vi.mocked(fs);
const mockLog = vi.mocked(log);

describe("confirmation utility", () => {
	let mockExit: MockInstance;

	beforeEach(() => {
		vi.clearAllMocks();
		mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit called");
		});
		mockFs.pathExists.mockResolvedValue(false as never);
		mockFs.ensureDir.mockResolvedValue(undefined as never);
		mockFs.writeJson.mockResolvedValue(undefined as never);
	});

	afterEach(() => {
		mockExit.mockRestore();
		vi.useRealTimers();
	});

	describe("generateToken", () => {
		it("should return 8-char hex string", () => {
			const token = generateToken();
			expect(token).toMatch(/^[0-9a-f]{8}$/);
		});

		it("should generate unique tokens", () => {
			const tokens = new Set(Array.from({ length: 20 }, () => generateToken()));
			expect(tokens.size).toBe(20);
		});
	});

	describe("computeCommandHash", () => {
		it("should return deterministic hash", () => {
			const h1 = computeCommandHash("clean feat", { project: "app" });
			const h2 = computeCommandHash("clean feat", { project: "app" });
			expect(h1).toBe(h2);
		});

		it("should return 16-char hex string", () => {
			const hash = computeCommandHash("clean feat", { project: "app" });
			expect(hash).toMatch(/^[0-9a-f]{16}$/);
		});

		it("should differ for different commands", () => {
			const h1 = computeCommandHash("clean feat-a", { project: "app" });
			const h2 = computeCommandHash("clean feat-b", { project: "app" });
			expect(h1).not.toBe(h2);
		});

		it("should differ for different args", () => {
			const h1 = computeCommandHash("clean feat", { project: "app-a" });
			const h2 = computeCommandHash("clean feat", { project: "app-b" });
			expect(h1).not.toBe(h2);
		});

		it("should be order-independent for args", () => {
			const h1 = computeCommandHash("spike feat", {
				project: "app",
				continue: "vm-1",
			});
			const h2 = computeCommandHash("spike feat", {
				continue: "vm-1",
				project: "app",
			});
			expect(h1).toBe(h2);
		});
	});

	describe("storeConfirmation + validateAndConsumeToken lifecycle", () => {
		it("should store and validate a token", async () => {
			vi.useFakeTimers();

			let savedStore: Record<string, unknown> = {};
			mockFs.writeJson.mockImplementation(async (_path, data) => {
				savedStore = data as Record<string, unknown>;
			});
			mockFs.pathExists.mockResolvedValue(false as never);

			const { token } = await storeConfirmation({
				command: "clean feat",
				args: { project: "app" },
				summary: "Delete feature VM",
			});

			expect(token).toMatch(/^[0-9a-f]{8}$/);
			expect(mockFs.writeJson).toHaveBeenCalled();

			// Advance past minimum age
			vi.advanceTimersByTime(11 * 1000);

			// Now simulate loading the saved store
			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(savedStore as never);

			const result = await validateAndConsumeToken({
				command: "clean feat",
				args: { project: "app" },
				token,
			});

			expect(result).not.toBeNull();
			expect(result).not.toBe("too_young");
			if (result && result !== "too_young") {
				expect(result.token).toBe(token);
				expect(result.command).toBe("clean feat");
			}
		});

		it("should return null for wrong token", async () => {
			let savedStore: Record<string, unknown> = {};
			mockFs.writeJson.mockImplementation(async (_path, data) => {
				savedStore = data as Record<string, unknown>;
			});
			mockFs.pathExists.mockResolvedValue(false as never);

			await storeConfirmation({
				command: "clean feat",
				args: { project: "app" },
				summary: "Delete feature VM",
			});

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(savedStore as never);

			const result = await validateAndConsumeToken({
				command: "clean feat",
				args: { project: "app" },
				token: "00000000",
			});

			expect(result).toBeNull();
		});

		it("should return null for expired token", async () => {
			vi.useFakeTimers();

			let savedStore: Record<string, unknown> = {};
			mockFs.writeJson.mockImplementation(async (_path, data) => {
				savedStore = data as Record<string, unknown>;
			});
			mockFs.pathExists.mockResolvedValue(false as never);

			const { token } = await storeConfirmation({
				command: "clean feat",
				args: { project: "app" },
				summary: "Delete feature VM",
			});

			// Advance past TTL
			vi.advanceTimersByTime(6 * 60 * 1000);

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(savedStore as never);

			const result = await validateAndConsumeToken({
				command: "clean feat",
				args: { project: "app" },
				token,
			});

			expect(result).toBeNull();
		});

		it("should consume token (one-time use)", async () => {
			vi.useFakeTimers();

			let savedStore: Record<string, unknown> = {};
			mockFs.writeJson.mockImplementation(async (_path, data) => {
				savedStore = data as Record<string, unknown>;
			});
			mockFs.pathExists.mockResolvedValue(false as never);

			const { token } = await storeConfirmation({
				command: "clean feat",
				args: { project: "app" },
				summary: "Delete feature VM",
			});

			// Advance past minimum age
			vi.advanceTimersByTime(11 * 1000);

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(savedStore as never);

			// First validation should succeed
			const result1 = await validateAndConsumeToken({
				command: "clean feat",
				args: { project: "app" },
				token,
			});
			expect(result1).not.toBeNull();
			expect(result1).not.toBe("too_young");

			// Second validation should fail (consumed)
			mockFs.readJson.mockResolvedValue(savedStore as never);
			const result2 = await validateAndConsumeToken({
				command: "clean feat",
				args: { project: "app" },
				token,
			});
			expect(result2).toBeNull();
		});

		it("should reject token used before minimum age", async () => {
			vi.useFakeTimers();

			let savedStore: Record<string, unknown> = {};
			mockFs.writeJson.mockImplementation(async (_path, data) => {
				savedStore = data as Record<string, unknown>;
			});
			mockFs.pathExists.mockResolvedValue(false as never);

			const { token } = await storeConfirmation({
				command: "clean feat",
				args: { project: "app" },
				summary: "Delete feature VM",
			});

			// Only advance 5 seconds (less than 10s minimum)
			vi.advanceTimersByTime(5 * 1000);

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(savedStore as never);

			const result = await validateAndConsumeToken({
				command: "clean feat",
				args: { project: "app" },
				token,
			});

			expect(result).toBe("too_young");
		});

		it("should accept token after minimum age", async () => {
			vi.useFakeTimers();

			let savedStore: Record<string, unknown> = {};
			mockFs.writeJson.mockImplementation(async (_path, data) => {
				savedStore = data as Record<string, unknown>;
			});
			mockFs.pathExists.mockResolvedValue(false as never);

			const { token } = await storeConfirmation({
				command: "clean feat",
				args: { project: "app" },
				summary: "Delete feature VM",
			});

			// Advance exactly 10 seconds
			vi.advanceTimersByTime(10 * 1000);

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(savedStore as never);

			const result = await validateAndConsumeToken({
				command: "clean feat",
				args: { project: "app" },
				token,
			});

			expect(result).not.toBeNull();
			expect(result).not.toBe("too_young");
		});
	});

	describe("prompt storage", () => {
		it("should store and return prompt with confirmation", async () => {
			vi.useFakeTimers();

			let savedStore: Record<string, unknown> = {};
			mockFs.writeJson.mockImplementation(async (_path, data) => {
				savedStore = data as Record<string, unknown>;
			});
			mockFs.pathExists.mockResolvedValue(false as never);

			const { token } = await storeConfirmation({
				command: "spike feat",
				args: { project: "app" },
				summary: "Create spike VM",
				prompt: "Build a login page",
			});

			vi.advanceTimersByTime(11 * 1000);

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(savedStore as never);

			const result = await validateAndConsumeToken({
				command: "spike feat",
				args: { project: "app" },
				token,
			});

			expect(result).not.toBeNull();
			expect(result).not.toBe("too_young");
			if (result && result !== "too_young") {
				expect(result.prompt).toBe("Build a login page");
			}
		});

		it("should return undefined prompt when none stored", async () => {
			vi.useFakeTimers();

			let savedStore: Record<string, unknown> = {};
			mockFs.writeJson.mockImplementation(async (_path, data) => {
				savedStore = data as Record<string, unknown>;
			});
			mockFs.pathExists.mockResolvedValue(false as never);

			const { token } = await storeConfirmation({
				command: "spike feat",
				args: { project: "app" },
				summary: "Create spike VM",
			});

			vi.advanceTimersByTime(11 * 1000);

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(savedStore as never);

			const result = await validateAndConsumeToken({
				command: "spike feat",
				args: { project: "app" },
				token,
			});

			expect(result).not.toBeNull();
			expect(result).not.toBe("too_young");
			if (result && result !== "too_young") {
				expect(result.prompt).toBeUndefined();
			}
		});

		it("should return storedPrompt from requireConfirmation on --confirm", async () => {
			vi.useFakeTimers();

			let savedStore: Record<string, unknown> = {};
			mockFs.writeJson.mockImplementation(async (_path, data) => {
				savedStore = data as Record<string, unknown>;
			});
			mockFs.pathExists.mockResolvedValue(false as never);

			const { token } = await storeConfirmation({
				command: "spike feat",
				args: { project: "app" },
				summary: "Create spike VM",
				prompt: "Build a login page",
			});

			vi.advanceTimersByTime(11 * 1000);

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(savedStore as never);

			const result = await requireConfirmation({
				command: "spike feat",
				args: { project: "app" },
				summary: "Create spike VM",
				details: () => {},
				confirmToken: token,
			});

			expect(result.storedPrompt).toBe("Build a login page");
		});
	});

	describe("requireConfirmation gate", () => {
		it("should error when no flags provided", async () => {
			await expect(
				requireConfirmation({
					command: "clean feat",
					args: { project: "app" },
					summary: "Delete VM",
					details: () => {},
				}),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith(
				"This command requires confirmation. Run with --dry-run first to review.",
			);
		});

		it("should print details and exit 0 on --dry-run", async () => {
			const detailsFn = vi.fn();

			await expect(
				requireConfirmation({
					command: "clean feat",
					args: { project: "app" },
					summary: "Delete VM",
					details: detailsFn,
					dryRun: true,
				}),
			).rejects.toThrow("process.exit called");

			expect(detailsFn).toHaveBeenCalled();
			expect(mockLog.info).toHaveBeenCalledWith(
				expect.stringContaining("Confirmation token:"),
			);
			expect(mockExit).toHaveBeenCalledWith(0);
		});

		it("should proceed on valid --confirm token", async () => {
			vi.useFakeTimers();

			let savedStore: Record<string, unknown> = {};
			mockFs.writeJson.mockImplementation(async (_path, data) => {
				savedStore = data as Record<string, unknown>;
			});
			mockFs.pathExists.mockResolvedValue(false as never);

			const { token } = await storeConfirmation({
				command: "clean feat",
				args: { project: "app" },
				summary: "Delete VM",
			});

			vi.advanceTimersByTime(11 * 1000);

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(savedStore as never);

			// Should not throw
			await requireConfirmation({
				command: "clean feat",
				args: { project: "app" },
				summary: "Delete VM",
				details: () => {},
				confirmToken: token,
			});
		});

		it("should show age error when token is too young", async () => {
			vi.useFakeTimers();

			let savedStore: Record<string, unknown> = {};
			mockFs.writeJson.mockImplementation(async (_path, data) => {
				savedStore = data as Record<string, unknown>;
			});
			mockFs.pathExists.mockResolvedValue(false as never);

			const { token } = await storeConfirmation({
				command: "clean feat",
				args: { project: "app" },
				summary: "Delete VM",
			});

			// Only 5 seconds — too young
			vi.advanceTimersByTime(5 * 1000);

			mockFs.pathExists.mockResolvedValue(true as never);
			mockFs.readJson.mockResolvedValue(savedStore as never);

			await expect(
				requireConfirmation({
					command: "clean feat",
					args: { project: "app" },
					summary: "Delete VM",
					details: () => {},
					confirmToken: token,
				}),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith(
				"Confirmation token must be at least 10 seconds old. This prevents automated agents from bypassing human review. Please wait and try again.",
			);
		});

		it("should error on invalid --confirm token", async () => {
			mockFs.pathExists.mockResolvedValue(false as never);

			await expect(
				requireConfirmation({
					command: "clean feat",
					args: { project: "app" },
					summary: "Delete VM",
					details: () => {},
					confirmToken: "badtoken",
				}),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith(
				"Invalid or expired confirmation token.",
			);
		});

		it("should proceed on --force when TTY", async () => {
			const origIsTTY = process.stdin.isTTY;
			Object.defineProperty(process.stdin, "isTTY", {
				value: true,
				writable: true,
			});

			// Should not throw
			await requireConfirmation({
				command: "clean feat",
				args: { project: "app" },
				summary: "Delete VM",
				details: () => {},
				force: true,
			});

			Object.defineProperty(process.stdin, "isTTY", {
				value: origIsTTY,
				writable: true,
			});
		});

		it("should error on --force when not TTY", async () => {
			const origIsTTY = process.stdin.isTTY;
			Object.defineProperty(process.stdin, "isTTY", {
				value: false,
				writable: true,
			});

			await expect(
				requireConfirmation({
					command: "clean feat",
					args: { project: "app" },
					summary: "Delete VM",
					details: () => {},
					force: true,
				}),
			).rejects.toThrow("process.exit called");

			expect(mockLog.error).toHaveBeenCalledWith(
				"--force requires an interactive terminal.",
			);

			Object.defineProperty(process.stdin, "isTTY", {
				value: origIsTTY,
				writable: true,
			});
		});
	});
});
