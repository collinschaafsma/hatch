import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	copyDir,
	ensureDir,
	fileExists,
	removeDir,
	setExecutable,
	writeFile,
} from "../../src/utils/fs.js";

describe("fs operations integration", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hatch-integration-"));
	});

	afterEach(async () => {
		await fs.remove(tempDir);
	});

	it("should create nested directory structure", async () => {
		const nestedPath = path.join(tempDir, "a", "b", "c", "d", "e");
		await ensureDir(nestedPath);
		expect(await fileExists(nestedPath)).toBe(true);
	});

	it("should write and read files correctly", async () => {
		const filePath = path.join(tempDir, "test.txt");
		const content = "Hello, World!";
		await writeFile(filePath, content);
		const readContent = await fs.readFile(filePath, "utf-8");
		expect(readContent).toBe(content);
	});

	it("should write files with special characters", async () => {
		const filePath = path.join(tempDir, "special.txt");
		const content =
			'const x = "hello";\nconst y = `template ${x}`;\n// 日本語コメント';
		await writeFile(filePath, content);
		const readContent = await fs.readFile(filePath, "utf-8");
		expect(readContent).toBe(content);
	});

	it("should copy directory with all contents", async () => {
		// Setup source
		const src = path.join(tempDir, "src");
		await ensureDir(src);
		await writeFile(path.join(src, "file1.txt"), "content1");
		await ensureDir(path.join(src, "nested"));
		await writeFile(path.join(src, "nested", "file2.txt"), "content2");
		await ensureDir(path.join(src, "nested", "deep"));
		await writeFile(path.join(src, "nested", "deep", "file3.txt"), "content3");

		// Copy
		const dest = path.join(tempDir, "dest");
		await copyDir(src, dest);

		// Verify
		expect(await fileExists(path.join(dest, "file1.txt"))).toBe(true);
		expect(await fileExists(path.join(dest, "nested", "file2.txt"))).toBe(true);
		expect(
			await fileExists(path.join(dest, "nested", "deep", "file3.txt")),
		).toBe(true);

		// Verify content
		expect(await fs.readFile(path.join(dest, "file1.txt"), "utf-8")).toBe(
			"content1",
		);
		expect(
			await fs.readFile(path.join(dest, "nested", "file2.txt"), "utf-8"),
		).toBe("content2");
		expect(
			await fs.readFile(
				path.join(dest, "nested", "deep", "file3.txt"),
				"utf-8",
			),
		).toBe("content3");
	});

	it("should set executable permissions", async () => {
		const filePath = path.join(tempDir, "script.sh");
		await writeFile(filePath, '#!/bin/bash\necho "hello"');
		await setExecutable(filePath);
		const stats = await fs.stat(filePath);
		// Check executable bits (owner at minimum)
		expect(stats.mode & 0o111).toBeTruthy();
	});

	it("should handle concurrent file writes", async () => {
		const files = Array.from({ length: 10 }, (_, i) => ({
			path: path.join(tempDir, `file${i}.txt`),
			content: `content${i}`,
		}));

		await Promise.all(files.map((f) => writeFile(f.path, f.content)));

		for (const file of files) {
			expect(await fileExists(file.path)).toBe(true);
			expect(await fs.readFile(file.path, "utf-8")).toBe(file.content);
		}
	});

	it("should handle removing and recreating directories", async () => {
		const dirPath = path.join(tempDir, "recreate");
		await ensureDir(dirPath);
		await writeFile(path.join(dirPath, "file.txt"), "content");

		await removeDir(dirPath);
		expect(await fileExists(dirPath)).toBe(false);

		await ensureDir(dirPath);
		expect(await fileExists(dirPath)).toBe(true);
	});

	it("should write files to deeply nested paths", async () => {
		const deepPath = path.join(
			tempDir,
			"apps",
			"web",
			"src",
			"components",
			"ui",
			"Button.tsx",
		);
		await writeFile(
			deepPath,
			"export const Button = () => <button>Click</button>;",
		);
		expect(await fileExists(deepPath)).toBe(true);
	});
});
