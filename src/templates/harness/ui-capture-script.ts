export function generateUiCaptureScript(): string {
	return `#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";

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

function inferRoute(filePath) {
  // Extract the route path from a Next.js app directory file
  // e.g. apps/web/app/(marketing)/about/page.tsx -> /about
  const match = filePath.match(/apps\\/web\\/app\\/(.+)\\/(page|layout|loading|error|not-found)\\.tsx?$/);
  if (!match) return null;

  const segments = match[1].split("/").filter((s) => {
    // Strip route groups like (marketing), (auth), (app)
    if (s.startsWith("(") && s.endsWith(")")) return false;
    // Strip private folders like _components
    if (s.startsWith("_")) return false;
    return true;
  });

  return "/" + segments.join("/");
}

function hasAgentBrowser() {
  try {
    execSync("which agent-browser", { stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

const harness = JSON.parse(readFileSync("harness.json", "utf-8"));
const uiPatterns = harness.evidence?.ui?.requiredForPatterns || [];
const changedFiles = getChangedFiles();
const devUrl = process.env.DEV_URL || "http://localhost:3000";

// Find changed files that match UI patterns
const uiFiles = changedFiles.filter((file) =>
  uiPatterns.some((pattern) => simpleGlobMatch(pattern, file))
);

if (uiFiles.length === 0) {
  console.log("No UI files changed — skipping evidence capture.");
  process.exit(0);
}

// Check for agent-browser
if (!hasAgentBrowser()) {
  console.log("agent-browser not found — skipping screenshot capture.");
  console.log("Install: https://github.com/vercel-labs/agent-browser");
  console.log("\\nUI files that would need evidence:");
  for (const file of uiFiles) {
    console.log("  " + file);
  }
  process.exit(0);
}

// Infer routes from changed files
const routes = [...new Set(
  uiFiles.map(inferRoute).filter(Boolean)
)];

if (routes.length === 0) {
  console.log("Changed UI files do not map to routes — skipping capture.");
  console.log("Files: " + uiFiles.join(", "));
  process.exit(0);
}

// Set up evidence directory
const evidenceDir = join(".harness", "evidence");
mkdirSync(evidenceDir, { recursive: true });

const manifest = {
  capturedAt: new Date().toISOString(),
  devUrl,
  routes: [],
};

console.log("Capturing browser evidence for " + routes.length + " route(s)...");

for (const route of routes) {
  const url = devUrl + route;
  const screenshotName = "screenshot-" + route.replace(/\\//g, "-").replace(/^-/, "") + ".png";
  const screenshotPath = join(evidenceDir, screenshotName);

  console.log("  " + route + " -> " + screenshotName);

  try {
    // Open the page in agent-browser
    execSync("agent-browser open " + JSON.stringify(url), {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    });

    // Wait briefly for page to render
    execSync("sleep 2");

    // Take screenshot
    execSync("agent-browser screenshot " + JSON.stringify(screenshotPath), {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
    });

    manifest.routes.push({
      route,
      url,
      screenshot: screenshotName,
      status: "captured",
    });
  } catch (err) {
    console.log("    Failed to capture: " + (err.message || err));
    manifest.routes.push({
      route,
      url,
      screenshot: null,
      status: "failed",
      error: err.message || String(err),
    });
  }
}

// Write manifest
writeFileSync(
  join(evidenceDir, "manifest.json"),
  JSON.stringify(manifest, null, 2)
);

const captured = manifest.routes.filter((r) => r.status === "captured").length;
const failed = manifest.routes.filter((r) => r.status === "failed").length;

console.log("\\nEvidence capture complete:");
console.log("  Captured: " + captured);
if (failed > 0) {
  console.log("  Failed: " + failed);
}
console.log("  Manifest: " + join(evidenceDir, "manifest.json"));
`;
}
