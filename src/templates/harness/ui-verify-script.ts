export function generateUiVerifyScript(): string {
	return `#!/usr/bin/env node
import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

function simpleGlobMatch(pattern, filePath) {
  const regexStr = pattern
    .replace(/[.+^$\{\\}()|[\\]\\\\]/g, "\\\\$&")
    .replace(/\\*\\*/g, "{{GLOBSTAR}}")
    .replace(/\\*/g, "[^/]*")
    .replace(/{{GLOBSTAR}}/g, ".*");
  return new RegExp("^" + regexStr + "$").test(filePath);
}

function getChangedFiles() {
  try {
    const output = execSync("git diff --name-only origin/main...HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.trim().split("\\n").filter(Boolean);
  } catch {
    try {
      const output = execSync("git diff --name-only HEAD", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return output.trim().split("\\n").filter(Boolean);
    } catch {
      return [];
    }
  }
}

const harness = JSON.parse(readFileSync("harness.json", "utf-8"));
const uiPatterns = harness.evidence?.ui?.requiredForPatterns || [];
const changedFiles = getChangedFiles();

// Find changed files that match UI patterns
const uiFiles = changedFiles.filter((file) =>
  uiPatterns.some((pattern) => simpleGlobMatch(pattern, file))
);

if (uiFiles.length === 0) {
  console.log("No UI files changed — no evidence required.");
  process.exit(0);
}

const manifestPath = join(".harness", "evidence", "manifest.json");

if (!existsSync(manifestPath)) {
  console.log("WARN: UI files changed but no evidence manifest found.");
  console.log("Run 'pnpm harness:ui:capture-browser-evidence' to capture screenshots.");
  console.log("\\nChanged UI files:");
  for (const file of uiFiles) {
    console.log("  " + file);
  }
  // Exit 0 — verification is advisory, not blocking
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const evidenceDir = join(".harness", "evidence");

let pass = 0;
let fail = 0;
const issues = [];

for (const entry of manifest.routes) {
  if (entry.status === "captured" && entry.screenshot) {
    const screenshotPath = join(evidenceDir, entry.screenshot);
    if (existsSync(screenshotPath)) {
      pass++;
    } else {
      fail++;
      issues.push("Missing screenshot file: " + entry.screenshot + " (route: " + entry.route + ")");
    }
  } else {
    fail++;
    issues.push("Capture failed for route: " + entry.route + (entry.error ? " (" + entry.error + ")" : ""));
  }
}

console.log("Evidence verification:");
console.log("  Passed: " + pass);
console.log("  Failed: " + fail);
console.log("  Captured at: " + manifest.capturedAt);

if (issues.length > 0) {
  console.log("\\nIssues:");
  for (const issue of issues) {
    console.log("  - " + issue);
  }
}

// Always exit 0 — verification is advisory
process.exit(0);
`;
}
