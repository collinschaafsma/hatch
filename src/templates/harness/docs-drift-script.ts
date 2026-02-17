export function generateDocsDriftScript(): string {
	return `#!/usr/bin/env node
import { readFileSync } from "fs";
import { execSync } from "child_process";

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
const changedFiles = getChangedFiles();

const tierOrder = ["high", "medium", "low"];
let resolvedTier = "low";

for (const tier of tierOrder) {
  const tierConfig = harness.riskTiers[tier];
  if (!tierConfig) continue;

  for (const pattern of tierConfig.patterns) {
    for (const file of changedFiles) {
      if (simpleGlobMatch(pattern, file)) {
        if (tierOrder.indexOf(tier) < tierOrder.indexOf(resolvedTier)) {
          resolvedTier = tier;
        }
      }
    }
  }
}

const tierConfig = harness.riskTiers[resolvedTier];
const docsDriftRules = tierConfig?.docsDriftRules || [];

if (docsDriftRules.length === 0) {
  console.log("No docs drift rules for tier: " + resolvedTier);
  process.exit(0);
}

const warnings = [];

for (const docPath of docsDriftRules) {
  if (!changedFiles.includes(docPath)) {
    warnings.push(docPath);
  }
}

if (warnings.length > 0) {
  console.log("Docs drift warning (" + resolvedTier + " tier changes detected):");
  console.log("");
  for (const doc of warnings) {
    console.log("  - " + doc + " was not updated");
  }
  console.log("");
  console.log("Consider updating these docs to reflect your changes.");
} else {
  console.log("All required docs were updated for " + resolvedTier + " tier changes.");
}

process.exit(0);
`;
}
