import path from "node:path";
import fs from "fs-extra";
import * as templates from "../templates/index.js";
import { ensureDir, fileExists, setExecutable, writeFile } from "./fs.js";

export interface HarnessScaffoldOptions {
	projectPath: string;
	projectName: string;
	skipExisting: boolean;
	includeDocs: boolean;
}

export interface HarnessScaffoldResult {
	written: string[];
	skipped: string[];
}

interface FileEntry {
	relativePath: string;
	content: string;
	executable?: boolean;
}

export async function scaffoldHarness(
	options: HarnessScaffoldOptions,
): Promise<HarnessScaffoldResult> {
	const { projectPath, projectName, skipExisting, includeDocs } = options;
	const result: HarnessScaffoldResult = { written: [], skipped: [] };

	const coreFiles: FileEntry[] = [
		{
			relativePath: "harness.json",
			content: templates.generateHarnessJson(projectName),
		},
		{
			relativePath: "AGENTS.md",
			content: templates.generateAgentsMd(projectName),
		},
		{
			relativePath: "scripts/harness/risk-tier.mjs",
			content: templates.generateRiskTierScript(),
			executable: true,
		},
		{
			relativePath: "scripts/harness/docs-drift-check.mjs",
			content: templates.generateDocsDriftScript(),
			executable: true,
		},
		{
			relativePath: "scripts/harness/ui-capture.mjs",
			content: templates.generateUiCaptureScript(),
			executable: true,
		},
		{
			relativePath: "scripts/harness/ui-verify.mjs",
			content: templates.generateUiVerifyScript(),
			executable: true,
		},
		{
			relativePath: "scripts/harness/ui-post-evidence.mjs",
			content: templates.generateUiPostEvidenceScript(),
			executable: true,
		},
		{
			relativePath: "scripts/harness/query-logs.mjs",
			content: templates.generateQueryLogsScript(),
			executable: true,
		},
		{
			relativePath: ".github/workflows/risk-policy-gate.yml",
			content: templates.generateRiskPolicyGateWorkflow(),
		},
	];

	const docFiles: FileEntry[] = [
		{
			relativePath: "docs/architecture.md",
			content: templates.generateDocsArchitecture(projectName),
		},
		{
			relativePath: "docs/patterns.md",
			content: templates.generateDocsPatterns(),
		},
		{
			relativePath: "docs/api-contracts.md",
			content: templates.generateDocsApiContracts(),
		},
		{
			relativePath: "docs/deployment.md",
			content: templates.generateDocsDeployment(projectName),
		},
		{
			relativePath: "docs/troubleshooting.md",
			content: templates.generateDocsTroubleshooting(),
		},
		{
			relativePath: "docs/decisions/adr-template.md",
			content: templates.generateAdrTemplate(),
		},
		{
			relativePath: "docs/plans/_template.md",
			content: templates.generatePlanTemplate(),
		},
		{
			relativePath: "docs/plans/README.md",
			content: templates.generatePlansIndex(),
		},
	];

	const files = includeDocs ? [...coreFiles, ...docFiles] : coreFiles;

	for (const file of files) {
		const fullPath = path.join(projectPath, file.relativePath);

		if (skipExisting && (await fileExists(fullPath))) {
			result.skipped.push(file.relativePath);
			continue;
		}

		await ensureDir(path.dirname(fullPath));
		await writeFile(fullPath, file.content);

		if (file.executable) {
			await setExecutable(fullPath);
		}

		result.written.push(file.relativePath);
	}

	return result;
}

const HARNESS_SCRIPTS: Record<string, string> = {
	"harness:risk-tier": "node scripts/harness/risk-tier.mjs",
	"harness:docs-drift": "node scripts/harness/docs-drift-check.mjs",
	"harness:pre-pr":
		"pnpm build && pnpm lint && pnpm typecheck && pnpm test && node scripts/harness/risk-tier.mjs",
	"harness:ui:capture-browser-evidence": "node scripts/harness/ui-capture.mjs",
	"harness:ui:verify-browser-evidence": "node scripts/harness/ui-verify.mjs",
	"harness:ui:post-evidence": "node scripts/harness/ui-post-evidence.mjs",
	"harness:logs": "node scripts/harness/query-logs.mjs",
	"harness:logs:errors": "node scripts/harness/query-logs.mjs --level error",
	"harness:logs:slow": "node scripts/harness/query-logs.mjs --slow 200",
	"harness:logs:summary": "node scripts/harness/query-logs.mjs --summary",
	"harness:logs:clear": "node scripts/harness/query-logs.mjs --clear",
};

export async function mergeHarnessPackageJsonScripts(
	packageJsonPath: string,
): Promise<boolean> {
	if (!(await fileExists(packageJsonPath))) {
		return false;
	}

	const pkg = await fs.readJson(packageJsonPath);
	if (!pkg.scripts) {
		pkg.scripts = {};
	}

	let added = false;
	for (const [key, value] of Object.entries(HARNESS_SCRIPTS)) {
		if (!(key in pkg.scripts)) {
			pkg.scripts[key] = value;
			added = true;
		}
	}

	if (added) {
		await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
	}

	return added;
}
