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
  if (match) {
    const segments = match[1].split("/").filter((s) => {
      // Strip route groups like (marketing), (auth), (app)
      if (s.startsWith("(") && s.endsWith(")")) return false;
      // Strip private folders like _components
      if (s.startsWith("_")) return false;
      return true;
    });
    return "/" + segments.join("/");
  }

  // Fallback: for component files inside _ prefixed dirs (e.g. _components),
  // walk up to the nearest parent that would be a route segment.
  // e.g. apps/web/app/(app)/profile/_components/basic-info.tsx -> /profile
  const appMatch = filePath.match(/apps\\/web\\/app\\/(.+)\\.tsx?$/);
  if (!appMatch) return null;

  const parts = appMatch[1].split("/");
  // Walk backwards, dropping the filename and any _ prefixed or route group segments
  // until we find a regular route segment
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    // Skip filenames, _ prefixed dirs, and route groups
    if (part.includes(".")) continue;
    if (part.startsWith("_")) continue;
    if (part.startsWith("(") && part.endsWith(")")) continue;

    // Found a route segment — build the route from start to here
    const routeSegments = parts.slice(0, i + 1).filter((s) => {
      if (s.startsWith("(") && s.endsWith(")")) return false;
      if (s.startsWith("_")) return false;
      return true;
    });
    return "/" + routeSegments.join("/");
  }

  return "/";
}

function hasAgentBrowser() {
  try {
    execSync("which agent-browser", { stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

function isErrorPage() {
  try {
    const title = execSync("agent-browser get title", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    }).trim();

    const errorTitles = ["Build Error", "Runtime Error", "Application error"];
    if (errorTitles.some((t) => title.includes(t))) return true;

    const bodyText = execSync('agent-browser eval "document.body.innerText"', {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });

    const errorTexts = [
      "Module not found",
      "Internal Server Error",
      "Unhandled Runtime Error",
      "Failed to compile",
    ];
    if (errorTexts.some((t) => bodyText.includes(t))) return true;

    return false;
  } catch {
    return false;
  }
}

function restartDevServer(devUrl) {
  try {
    execSync("rm -rf apps/web/.next", { stdio: ["pipe", "pipe", "pipe"] });
    try {
      execSync("pkill -f 'next dev'", { stdio: ["pipe", "pipe", "pipe"] });
    } catch {}
    execSync("cd apps/web && nohup pnpm dev > /dev/null 2>&1 &", {
      stdio: ["pipe", "pipe", "pipe"],
      shell: "/bin/sh",
    });

    // Poll until dev server is ready (up to 30s)
    for (let i = 0; i < 15; i++) {
      try {
        const code = execSync(
          'curl -s -o /dev/null -w "%{http_code}" ' + JSON.stringify(devUrl),
          { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 5000 }
        ).trim();
        if (code === "200") return true;
      } catch {}
      execSync("sleep 2", { stdio: ["pipe", "pipe", "pipe"] });
    }
    return false;
  } catch {
    return false;
  }
}

function authenticateAgentBrowser(devUrl) {
  try {
    // Read NEXT_PUBLIC_CONVEX_SITE_URL from .env.local or environment
    let convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "";
    if (!convexSiteUrl) {
      try {
        const envLocal = readFileSync("apps/web/.env.local", "utf-8");
        const match = envLocal.match(/^NEXT_PUBLIC_CONVEX_SITE_URL=(.+)$/m);
        if (match) convexSiteUrl = match[1].trim();
      } catch {}
    }

    if (!convexSiteUrl) {
      console.log("No CONVEX_SITE_URL found — skipping dev auth.");
      return false;
    }

    // Call the dev-auth endpoint to get a session cookie
    const result = execSync(
      "curl -s -D - -X POST " + JSON.stringify(convexSiteUrl + "/api/dev-auth"),
      { encoding: "utf-8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] }
    );

    // Parse session token from Set-Cookie header
    const cookieMatch = result.match(/set-cookie:.*better-auth\\.session_token=([^;\\s]+)/i);
    if (!cookieMatch) {
      console.log("Dev auth: no session cookie in response — skipping.");
      return false;
    }

    const token = cookieMatch[1];

    // Inject cookie into agent-browser
    execSync("agent-browser cookies set better-auth.session_token " + JSON.stringify(token), {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });

    console.log("Dev auth: authenticated as dev@test.local");
    return true;
  } catch (err) {
    console.log("Dev auth failed (continuing without auth): " + (err.message || err));
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

// Authenticate agent-browser for protected routes
authenticateAgentBrowser(devUrl);

console.log("Capturing browser evidence for " + routes.length + " route(s)...");

let hasRestarted = false;

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

    // Set tall viewport to capture full scrollable content
    execSync("agent-browser set viewport 1280 2400", {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });

    // Wait for layout reflow
    execSync("agent-browser wait 2000", {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });

    // Take full page screenshot
    execSync("agent-browser screenshot --full " + JSON.stringify(screenshotPath), {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
    });

    // Check if page shows an error
    if (isErrorPage()) {
      if (!hasRestarted) {
        console.log("    Error page detected — clearing cache and restarting dev server...");
        hasRestarted = true;
        if (restartDevServer(devUrl)) {
          // Re-navigate, re-set viewport, re-wait, re-screenshot
          execSync("agent-browser open " + JSON.stringify(url), {
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 30000,
          });
          execSync("agent-browser set viewport 1280 2400", {
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 10000,
          });
          execSync("agent-browser wait 2000", {
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 10000,
          });
          execSync("agent-browser screenshot --full " + JSON.stringify(screenshotPath), {
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 15000,
          });

          if (isErrorPage()) {
            console.log("    Still showing error after restart — marking as error.");
            manifest.routes.push({ route, url, screenshot: screenshotName, status: "error" });
            continue;
          }
        } else {
          console.log("    Dev server restart failed — marking as error.");
          manifest.routes.push({ route, url, screenshot: screenshotName, status: "error" });
          continue;
        }
      } else {
        console.log("    Error page detected (server already restarted) — marking as error.");
        manifest.routes.push({ route, url, screenshot: screenshotName, status: "error" });
        continue;
      }
    }

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
const errors = manifest.routes.filter((r) => r.status === "error").length;

console.log("\\nEvidence capture complete:");
console.log("  Captured: " + captured);
if (failed > 0) {
  console.log("  Failed: " + failed);
}
if (errors > 0) {
  console.log("  Errors: " + errors);
}
console.log("  Manifest: " + join(evidenceDir, "manifest.json"));
`;
}
