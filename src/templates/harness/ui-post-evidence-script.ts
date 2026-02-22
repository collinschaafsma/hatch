export function generateUiPostEvidenceScript(): string {
	return `#!/usr/bin/env node
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

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

// Force-add evidence files and commit
try {
  execSync("git add -f .harness/evidence/", {
    stdio: ["pipe", "pipe", "pipe"],
  });
  execSync('git commit -m "chore: add UI evidence screenshots"', {
    stdio: ["pipe", "pipe", "pipe"],
  });
  console.log("Committed evidence screenshots.");
} catch (err) {
  // If nothing to commit, that's fine — files may already be committed
  const msg = err.message || String(err);
  if (msg.includes("nothing to commit")) {
    console.log("Evidence already committed.");
  } else {
    console.log("Git commit note: " + msg);
  }
}

// Push
try {
  execSync("git push", {
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 30000,
  });
  console.log("Pushed to " + branch + ".");
} catch (err) {
  console.log("Push failed: " + (err.message || err));
  console.log("Screenshots are committed locally but not pushed.");
  process.exit(0);
}

// Build markdown comment
const header = "## UI Evidence Screenshots";
let body = header + "\\n\\n";
body += "Captured at: " + manifest.capturedAt + "\\n\\n";

for (const route of manifest.routes) {
  body += "### \`" + route.route + "\`\\n\\n";
  if (route.status === "captured" && route.screenshot) {
    const imageUrl =
      "https://raw.githubusercontent.com/" +
      owner + "/" + repo + "/" + branch +
      "/.harness/evidence/" + route.screenshot;
    body += "![" + route.route + "](" + imageUrl + ")\\n\\n";
  } else {
    body += "_Failed to capture: " + (route.error || "unknown error") + "_\\n\\n";
  }
}

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
        " -X PATCH -f body=" + JSON.stringify(body),
      { stdio: ["pipe", "pipe", "pipe"], timeout: 15000 }
    );
    console.log("Updated existing evidence comment on PR #" + prNumber + ".");
  } else {
    execSync(
      "gh pr comment " + prNumber + " --body " + JSON.stringify(body),
      { stdio: ["pipe", "pipe", "pipe"], timeout: 15000 }
    );
    console.log("Posted evidence comment on PR #" + prNumber + ".");
  }
} catch (err) {
  console.log("Failed to post PR comment: " + (err.message || err));
  console.log("Screenshots are committed and pushed but comment was not posted.");
}
`;
}
