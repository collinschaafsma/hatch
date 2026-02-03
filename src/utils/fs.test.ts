import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs-extra", () => ({
	default: {
		ensureDir: vi.fn(),
		writeFile: vi.fn(),
		pathExists: vi.fn(),
		remove: vi.fn(),
		copy: vi.fn(),
		chmod: vi.fn(),
	},
}));

import fs from "fs-extra";
import {
	copyDir,
	ensureDir,
	fileExists,
	removeDir,
	setExecutable,
	writeFile,
} from "./fs.js";

const mockFs = vi.mocked(fs);

describe("fs utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("ensureDir", () => {
		it("should call fs.ensureDir with provided path", async () => {
			mockFs.ensureDir.mockResolvedValue(undefined as never);

			await ensureDir("/path/to/dir");

			expect(mockFs.ensureDir).toHaveBeenCalledWith("/path/to/dir");
		});
	});

	describe("writeFile", () => {
		it("should ensure parent directory exists and write file", async () => {
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeFile.mockResolvedValue(undefined as never);

			await writeFile("/path/to/file.txt", "content");

			expect(mockFs.ensureDir).toHaveBeenCalledWith("/path/to");
			expect(mockFs.writeFile).toHaveBeenCalledWith(
				"/path/to/file.txt",
				"content",
				"utf-8",
			);
		});

		it("should handle nested paths correctly", async () => {
			mockFs.ensureDir.mockResolvedValue(undefined as never);
			mockFs.writeFile.mockResolvedValue(undefined as never);

			await writeFile("/a/b/c/d/file.json", '{"key": "value"}');

			expect(mockFs.ensureDir).toHaveBeenCalledWith("/a/b/c/d");
		});
	});

	describe("fileExists", () => {
		it("should return true when file exists", async () => {
			mockFs.pathExists.mockResolvedValue(true as never);

			const result = await fileExists("/path/to/existing-file.txt");

			expect(result).toBe(true);
			expect(mockFs.pathExists).toHaveBeenCalledWith(
				"/path/to/existing-file.txt",
			);
		});

		it("should return false when file does not exist", async () => {
			mockFs.pathExists.mockResolvedValue(false as never);

			const result = await fileExists("/path/to/missing-file.txt");

			expect(result).toBe(false);
		});
	});

	describe("removeDir", () => {
		it("should call fs.remove with provided path", async () => {
			mockFs.remove.mockResolvedValue(undefined as never);

			await removeDir("/path/to/dir");

			expect(mockFs.remove).toHaveBeenCalledWith("/path/to/dir");
		});
	});

	describe("copyDir", () => {
		it("should call fs.copy with source and destination", async () => {
			mockFs.copy.mockResolvedValue(undefined as never);

			await copyDir("/source/dir", "/dest/dir");

			expect(mockFs.copy).toHaveBeenCalledWith("/source/dir", "/dest/dir");
		});
	});

	describe("setExecutable", () => {
		it("should set file permissions to 0o755", async () => {
			mockFs.chmod.mockResolvedValue(undefined as never);

			await setExecutable("/path/to/script.sh");

			expect(mockFs.chmod).toHaveBeenCalledWith("/path/to/script.sh", 0o755);
		});
	});
});
