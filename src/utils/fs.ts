import path from "node:path";
import fs from "fs-extra";

export async function ensureDir(dirPath: string): Promise<void> {
	await fs.ensureDir(dirPath);
}

export async function writeFile(
	filePath: string,
	content: string,
): Promise<void> {
	await fs.ensureDir(path.dirname(filePath));
	await fs.writeFile(filePath, content, "utf-8");
}

export async function fileExists(filePath: string): Promise<boolean> {
	return await fs.pathExists(filePath);
}

export async function removeDir(dirPath: string): Promise<void> {
	await fs.remove(dirPath);
}

export async function copyDir(src: string, dest: string): Promise<void> {
	await fs.copy(src, dest);
}

export async function setExecutable(filePath: string): Promise<void> {
	await fs.chmod(filePath, 0o755);
}
