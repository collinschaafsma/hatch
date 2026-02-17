export function generateRiskTierScript(): string {
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
const jsonFlag = process.argv.includes("--json");

const tierOrder = ["high", "medium", "low"];
let resolvedTier = "low";
const matchedPatterns = [];

for (const tier of tierOrder) {
  const tierConfig = harness.riskTiers[tier];
  if (!tierConfig) continue;

  for (const pattern of tierConfig.patterns) {
    for (const file of changedFiles) {
      if (simpleGlobMatch(pattern, file)) {
        matchedPatterns.push({ tier, pattern, file });
        if (tierOrder.indexOf(tier) < tierOrder.indexOf(resolvedTier)) {
          resolvedTier = tier;
        }
      }
    }
  }
}

if (jsonFlag) {
  console.log(
    JSON.stringify(
      {
        tier: resolvedTier,
        changedFiles,
        matchedPatterns,
      },
      null,
      2,
    ),
  );
} else {
  console.log("Risk tier: " + resolvedTier);
  console.log("Changed files: " + changedFiles.length);
  if (matchedPatterns.length > 0) {
    console.log("\\nMatched patterns:");
    for (const match of matchedPatterns) {
      console.log("  [" + match.tier + "] " + match.pattern + " -> " + match.file);
    }
  }
  const tierConfig = harness.riskTiers[resolvedTier];
  if (tierConfig) {
    console.log("\\nRequired checks: " + tierConfig.requiredChecks.join(", "));
  }
}

process.exit(0);
`;
}
