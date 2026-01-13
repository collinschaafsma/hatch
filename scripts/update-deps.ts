#!/usr/bin/env tsx

import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import kleur from "kleur";

// Template files to scan
const TEMPLATE_FILES = [
	"src/templates/root/package-json.ts",
	"src/templates/web/package-json.ts",
	"src/templates/ui/package-json.ts",
];

// Match: "package-name": "^1.2.3" (with optional prerelease suffix)
const PACKAGE_REGEX =
	/["'](@?[\w\/-]+)["']\s*:\s*["'](\^[\d]+\.[\d]+\.[\d]+(?:-[\w.]+)?)["']/g;

const NPM_REGISTRY = "https://registry.npmjs.org";
const CONCURRENCY_LIMIT = 5;
const DELAY_MS = 100;

interface PackageInfo {
	name: string;
	currentVersion: string;
	filePath: string;
}

interface PackageUpdate extends PackageInfo {
	latestVersion: string;
}

function isBetaVersion(version: string): boolean {
	return /-(alpha|beta|rc|canary|next|preview)/i.test(version);
}

function extractPackages(filePath: string, content: string): PackageInfo[] {
	const packages: PackageInfo[] = [];

	for (const match of content.matchAll(PACKAGE_REGEX)) {
		const [, packageName, version] = match;

		// Skip workspace references and beta versions
		if (version.includes("workspace:")) continue;
		if (isBetaVersion(version)) continue;

		packages.push({
			name: packageName,
			currentVersion: version,
			filePath,
		});
	}

	return packages;
}

async function fetchLatestVersion(packageName: string): Promise<string | null> {
	try {
		const response = await fetch(
			`${NPM_REGISTRY}/${encodeURIComponent(packageName)}/latest`,
		);
		if (!response.ok) return null;
		const data = (await response.json()) as { version: string };
		return `^${data.version}`;
	} catch {
		return null;
	}
}

function chunk<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}

async function fetchLatestVersions(
	packageNames: string[],
): Promise<Map<string, string>> {
	const results = new Map<string, string>();
	const chunks = chunk([...new Set(packageNames)], CONCURRENCY_LIMIT);

	for (const batch of chunks) {
		const promises = batch.map(async (name) => {
			const version = await fetchLatestVersion(name);
			return { name, version };
		});

		const settled = await Promise.all(promises);
		for (const { name, version } of settled) {
			if (version) {
				results.set(name, version);
			}
		}

		// Small delay between batches
		if (chunks.indexOf(batch) < chunks.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
		}
	}

	return results;
}

async function updateFile(
	filePath: string,
	updates: Map<string, { current: string; latest: string }>,
): Promise<void> {
	let content = await fs.readFile(filePath, "utf-8");

	for (const [packageName, { current, latest }] of updates) {
		const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const escapedCurrent = current.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

		const pattern = new RegExp(
			`(["']${escapedName}["']\\s*:\\s*["'])${escapedCurrent}(["'])`,
			"g",
		);

		content = content.replace(pattern, `$1${latest}$2`);
	}

	await fs.writeFile(filePath, content, "utf-8");
}

async function main() {
	const program = new Command()
		.name("update-deps")
		.description(
			"Update package.json template dependencies to latest npm versions",
		)
		.option("--dry-run", "Show what would be updated without making changes")
		.parse();

	const options = program.opts<{ dryRun?: boolean }>();
	const rootDir = path.resolve(import.meta.dirname, "..");

	console.log(kleur.cyan("\nScanning template files for dependencies...\n"));

	// 1. Extract all packages from template files
	const allPackages: PackageInfo[] = [];

	for (const relativePath of TEMPLATE_FILES) {
		const filePath = path.join(rootDir, relativePath);
		const content = await fs.readFile(filePath, "utf-8");
		const packages = extractPackages(filePath, content);
		allPackages.push(...packages);
	}

	const uniqueNames = [...new Set(allPackages.map((p) => p.name))];
	console.log(
		kleur.blue(`Found ${uniqueNames.length} unique packages to check\n`),
	);

	// 2. Fetch latest versions from npm
	console.log(kleur.cyan("Fetching latest versions from npm...\n"));
	const latestVersions = await fetchLatestVersions(uniqueNames);

	// 3. Determine updates needed
	const updates: PackageUpdate[] = [];

	for (const pkg of allPackages) {
		const latest = latestVersions.get(pkg.name);
		if (latest && latest !== pkg.currentVersion) {
			updates.push({ ...pkg, latestVersion: latest });
		}
	}

	// 4. Display results
	if (updates.length === 0) {
		console.log(kleur.green("All packages are up to date!\n"));
		return;
	}

	console.log(kleur.yellow(`Found ${updates.length} packages to update:\n`));

	// Group by file
	const byFile = new Map<string, PackageUpdate[]>();
	for (const update of updates) {
		const existing = byFile.get(update.filePath) || [];
		existing.push(update);
		byFile.set(update.filePath, existing);
	}

	for (const [filePath, fileUpdates] of byFile) {
		const relativePath = path.relative(rootDir, filePath);
		console.log(kleur.blue(`  ${relativePath}:`));
		for (const update of fileUpdates) {
			console.log(
				`    ${update.name}: ${kleur.red(update.currentVersion)} → ${kleur.green(update.latestVersion)}`,
			);
		}
		console.log();
	}

	// 5. Apply updates (unless dry-run)
	if (options.dryRun) {
		console.log(kleur.yellow("Dry run mode - no changes made\n"));
		return;
	}

	console.log(kleur.cyan("Applying updates...\n"));

	for (const [filePath, fileUpdates] of byFile) {
		const updateMap = new Map<string, { current: string; latest: string }>();
		for (const update of fileUpdates) {
			updateMap.set(update.name, {
				current: update.currentVersion,
				latest: update.latestVersion,
			});
		}
		await updateFile(filePath, updateMap);

		const relativePath = path.relative(rootDir, filePath);
		console.log(kleur.green(`  ✓ Updated ${relativePath}`));
	}

	console.log(kleur.green("\nDone!\n"));
}

main().catch((error) => {
	console.error(kleur.red("Error:"), error.message);
	process.exit(1);
});
