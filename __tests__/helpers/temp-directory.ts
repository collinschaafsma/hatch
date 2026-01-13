import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

export interface TempDirectory {
	path: string;
	cleanup: () => Promise<void>;
}

export async function createTempDirectory(
	prefix = "hatch-test-",
): Promise<TempDirectory> {
	const dirPath = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
	return {
		path: dirPath,
		cleanup: async () => {
			await fs.remove(dirPath);
		},
	};
}

export async function createTempFile(
	tempDir: string,
	relativePath: string,
	content: string,
): Promise<string> {
	const filePath = path.join(tempDir, relativePath);
	await fs.ensureDir(path.dirname(filePath));
	await fs.writeFile(filePath, content, "utf-8");
	return filePath;
}
