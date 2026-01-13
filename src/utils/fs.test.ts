import os from "node:os";
import path from "node:path";
import fsExtra from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	copyDir,
	ensureDir,
	fileExists,
	removeDir,
	setExecutable,
	writeFile,
} from "./fs.js";

describe("fs utilities", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "hatch-fs-test-"));
	});

	afterEach(async () => {
		await fsExtra.remove(tempDir);
	});

	describe("ensureDir", () => {
		it("should create directory if not exists", async () => {
			const dirPath = path.join(tempDir, "new-dir");
			await ensureDir(dirPath);
			expect(await fsExtra.pathExists(dirPath)).toBe(true);
		});

		it("should not throw if directory exists", async () => {
			const dirPath = path.join(tempDir, "existing-dir");
			await fsExtra.ensureDir(dirPath);
			await expect(ensureDir(dirPath)).resolves.not.toThrow();
		});

		it("should create nested directories", async () => {
			const nestedPath = path.join(tempDir, "a", "b", "c");
			await ensureDir(nestedPath);
			expect(await fsExtra.pathExists(nestedPath)).toBe(true);
		});
	});

	describe("writeFile", () => {
		it("should write content to file", async () => {
			const filePath = path.join(tempDir, "test.txt");
			await writeFile(filePath, "Hello, World!");
			const content = await fsExtra.readFile(filePath, "utf-8");
			expect(content).toBe("Hello, World!");
		});

		it("should create parent directories", async () => {
			const filePath = path.join(tempDir, "nested", "dir", "test.txt");
			await writeFile(filePath, "content");
			expect(await fsExtra.pathExists(filePath)).toBe(true);
		});

		it("should overwrite existing files", async () => {
			const filePath = path.join(tempDir, "test.txt");
			await writeFile(filePath, "original");
			await writeFile(filePath, "updated");
			const content = await fsExtra.readFile(filePath, "utf-8");
			expect(content).toBe("updated");
		});

		it("should write utf-8 content", async () => {
			const filePath = path.join(tempDir, "unicode.txt");
			const unicodeContent = "Hello 你好 مرحبا 🎉";
			await writeFile(filePath, unicodeContent);
			const content = await fsExtra.readFile(filePath, "utf-8");
			expect(content).toBe(unicodeContent);
		});
	});

	describe("fileExists", () => {
		it("should return true for existing file", async () => {
			const filePath = path.join(tempDir, "existing.txt");
			await fsExtra.writeFile(filePath, "content");
			expect(await fileExists(filePath)).toBe(true);
		});

		it("should return false for non-existing file", async () => {
			const filePath = path.join(tempDir, "non-existing.txt");
			expect(await fileExists(filePath)).toBe(false);
		});

		it("should return true for existing directory", async () => {
			const dirPath = path.join(tempDir, "existing-dir");
			await fsExtra.ensureDir(dirPath);
			expect(await fileExists(dirPath)).toBe(true);
		});
	});

	describe("removeDir", () => {
		it("should remove directory and contents", async () => {
			const dirPath = path.join(tempDir, "to-remove");
			await fsExtra.ensureDir(dirPath);
			await fsExtra.writeFile(path.join(dirPath, "file.txt"), "content");
			await removeDir(dirPath);
			expect(await fsExtra.pathExists(dirPath)).toBe(false);
		});

		it("should not throw if directory does not exist", async () => {
			const dirPath = path.join(tempDir, "non-existing");
			await expect(removeDir(dirPath)).resolves.not.toThrow();
		});
	});

	describe("copyDir", () => {
		it("should copy directory contents", async () => {
			const src = path.join(tempDir, "src");
			const dest = path.join(tempDir, "dest");
			await fsExtra.ensureDir(src);
			await fsExtra.writeFile(path.join(src, "file1.txt"), "content1");
			await fsExtra.ensureDir(path.join(src, "nested"));
			await fsExtra.writeFile(
				path.join(src, "nested", "file2.txt"),
				"content2",
			);

			await copyDir(src, dest);

			expect(await fsExtra.pathExists(path.join(dest, "file1.txt"))).toBe(true);
			expect(
				await fsExtra.pathExists(path.join(dest, "nested", "file2.txt")),
			).toBe(true);
			expect(
				await fsExtra.readFile(path.join(dest, "file1.txt"), "utf-8"),
			).toBe("content1");
		});
	});

	describe("setExecutable", () => {
		it("should set file permissions to 755", async () => {
			const filePath = path.join(tempDir, "script.sh");
			await fsExtra.writeFile(filePath, '#!/bin/bash\necho "hello"');
			await setExecutable(filePath);
			const stats = await fsExtra.stat(filePath);
			// Check that at least the owner execute bit is set
			expect(stats.mode & 0o100).toBeTruthy();
		});
	});
});
