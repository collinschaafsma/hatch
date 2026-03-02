export function generateUiPostEvidenceScript(): string {
	return `#!/usr/bin/env node
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";

const evidenceDir = join(".harness", "evidence");
const manifestPath = join(evidenceDir, "manifest.json");

// Read manifest
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
} catch {
  console.log("No evidence manifest found at " + manifestPath + " — nothing to post.");
  process.exit(0);
}

const captured = (manifest.routes || []).filter((r) => r.status === "captured");
if (captured.length === 0) {
  console.log("No captured screenshots in manifest — nothing to post.");
  process.exit(0);
}

// Detect branch
let branch;
try {
  branch = execSync("git rev-parse --abbrev-ref HEAD", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
} catch {
  console.log("Could not detect git branch — skipping.");
  process.exit(0);
}

// Get repo info via gh CLI
let owner, repo;
try {
  const repoInfo = JSON.parse(
    execSync("gh repo view --json owner,name", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
  );
  owner = repoInfo.owner.login;
  repo = repoInfo.name;
} catch {
  console.log("Could not detect GitHub repo (is gh CLI authenticated?) — skipping.");
  process.exit(0);
}

// Get PR number for current branch
let prNumber;
try {
  const prInfo = JSON.parse(
    execSync("gh pr view --json number", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
  );
  prNumber = prInfo.number;
} catch {
  console.log("No PR found for branch " + branch + " — skipping.");
  process.exit(0);
}

// Upload evidence files to a gist
const filesToUpload = captured
  .filter(r => r.screenshot)
  .map(r => join(evidenceDir, r.screenshot));
filesToUpload.push(manifestPath);

let gistUrl, gistId, gistOwner;
try {
  const result = execSync(
    "gh gist create --public " + filesToUpload.join(" "),
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
  // result is the gist URL like https://gist.github.com/user/abc123
  gistUrl = result;
  const parts = new URL(result).pathname.split("/").filter(Boolean);
  gistOwner = parts[0];
  gistId = parts[1];
  console.log("Uploaded evidence to gist: " + gistUrl);
} catch (err) {
  console.log("Failed to create gist: " + (err.message || err));
  console.log("Evidence captured locally but not posted.");
  process.exit(0);
}

// Build markdown comment body
const header = "## UI Evidence Screenshots";
let body = header + "\\n\\n";
body += "Captured at: " + manifest.capturedAt + "\\n\\n";

for (const route of manifest.routes) {
  body += "### \\\`" + route.route + "\\\`\\n\\n";
  if (route.status === "captured" && route.screenshot) {
    // Use blob URL with ?raw=true — works for both public and private repos
    const imageUrl =
      "https://gist.githubusercontent.com/" +
      gistOwner + "/" + gistId + "/raw/" + route.screenshot;
    body += "![" + route.route + "](" + imageUrl + ")\\n\\n";
  } else {
    body += "_Failed to capture: " + (route.error || "unknown error") + "_\\n\\n";
  }
}

// Write body to a temp file for gh CLI (avoids shell escaping issues with JSON.stringify)
const tmpFile = join(tmpdir(), "pr-evidence-comment-" + Date.now() + ".md");
writeFileSync(tmpFile, body);

// Check for existing evidence comment to edit instead of creating a new one
let existingCommentId;
try {
  const comments = JSON.parse(
    execSync(
      "gh pr view " + prNumber + " --json comments --jq '.comments'",
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    )
  );
  const existing = comments.find(
    (c) => c.body && c.body.startsWith(header)
  );
  if (existing) {
    existingCommentId = existing.id;
  }
} catch {
  // If we can't check, just create a new comment
}

// Post or update comment
try {
  if (existingCommentId) {
    execSync(
      "gh api repos/" + owner + "/" + repo + "/issues/comments/" + existingCommentId +
        " -X PATCH -F body=@" + tmpFile,
      { stdio: ["pipe", "pipe", "pipe"], timeout: 15000 }
    );
    console.log("Updated existing evidence comment on PR #" + prNumber + ".");
  } else {
    execSync(
      "gh pr comment " + prNumber + " --body-file " + tmpFile,
      { stdio: ["pipe", "pipe", "pipe"], timeout: 15000 }
    );
    console.log("Posted evidence comment on PR #" + prNumber + ".");
  }
} catch (err) {
  console.log("Failed to post PR comment: " + (err.message || err));
  console.log("Screenshots were uploaded to gist but PR comment was not posted.");
} finally {
  try { unlinkSync(tmpFile); } catch {}
}
`;
}
