# Spike Monitor API Contract

The agent-runner pushes structured events to an HTTP endpoint during spike runs. This document defines the three endpoints that a monitoring backend must implement.

All requests include:
- `Content-Type: application/json`
- `Authorization: Bearer <token>` (from `config.monitor.token`)
- 10-second timeout

---

## POST `/api/runs/start`

Called once when the agent-runner starts. Registers a new spike run and returns a server-generated `runId`.

### Request Body

```typescript
{
  // Identity
  vmName: string;           // "peaceful-duckling" — exe.dev VM name
  sshHost: string;          // "peaceful-duckling.exe.xyz" — SSH hostname
  feature: string;          // "add-dark-mode" — feature/branch name
  project: string;          // "my-app" — project name

  // Context
  prompt: string;           // The full user prompt for this iteration
  iteration: number;        // 1 for first run, 2+ for continuations

  // GitHub
  github: {
    repoUrl: string;        // "https://github.com/org/my-app"
    owner: string;          // "org"
    repo: string;           // "my-app"
    branch: string;         // "add-dark-mode" (same as feature)
  };

  // Deployment URLs
  vercelUrl: string | null;            // "https://my-app.vercel.app"
  convexPreviewDeployment: {
    deploymentUrl: string;             // "https://happy-animal-123.convex.cloud"
    deploymentName: string;            // "happy-animal-123"
  } | null;

  // Prior iterations (for context in dashboard)
  previousIterations: Array<{
    prompt: string;
    sessionId?: string;
    timestamp: string;       // ISO 8601
    cost: {
      totalUsd: number;
      inputTokens: number;
      outputTokens: number;
    };
  }>;
}
```

### Response

```typescript
{
  runId: string;  // Server-generated ID, used in all subsequent calls
}
```

### Error Handling

If this call fails, the agent-runner disables remote monitoring entirely and continues with local-only logging.

---

## POST `/api/runs/events`

Called periodically to push buffered log events. Flush triggers:
- Every **3 seconds** (timer-based)
- When the buffer reaches **20 events**
- **Immediately** on `error` events (high priority)

### Request Body

```typescript
{
  runId: string;             // From /api/runs/start response
  events: Array<{
    seq: number;             // Monotonically increasing, for ordering
    timestamp: string;       // ISO 8601 from the VM

    type: "tool_start"       // Claude started using a tool
        | "tool_end"         // Tool execution completed
        | "message"          // Claude's text output
        | "error";           // Error occurred

    // Present on tool events
    tool?: string;           // "Read", "Bash", "Edit", "Write", "Glob", "Grep"
    description?: string;    // "Reading src/app/page.tsx", "Running: git commit..."

    // Present on message events
    message?: string;        // Claude's text output (truncated to 500 chars)

    // Cumulative cost at time of event
    costSnapshot?: {
      inputTokens: number;
      outputTokens: number;
      totalUsd: number;
    };
  }>;
}
```

### Response

```typescript
{ ok: true }
```

### Error Handling

- Failed pushes re-buffer the events for retry on the next flush
- After **3 consecutive failures**, remote monitoring is disabled and buffered events are dropped
- A warning is logged to `spike.log`

### Design Notes

- **`costSnapshot`** is cumulative (not per-event), so the dashboard can show a live cost counter from the latest event without summing
- **`input`/`output`** from `ProgressEvent` are intentionally omitted — they contain full file contents and command outputs that are too large for real-time streaming. The `description` field has the human-readable summary. Raw data stays in `spike-progress.jsonl` on the VM.

---

## POST `/api/runs/complete`

Called once when the agent finishes (success or failure). Includes final cost, timing, PR metadata, and plan progress.

### Request Body

```typescript
{
  runId: string;
  status: "completed" | "failed";

  // Final cost
  cost: {
    totalUsd: number;
    inputTokens: number;
    outputTokens: number;
  };

  // Timing
  durationMs: number;         // Wall clock time from start to completion

  // Session info
  sessionId?: string;

  // Error details (when status is "failed")
  error?: string;

  // PR info (if a PR was created or already exists)
  pr?: {
    url: string;              // "https://github.com/org/my-app/pull/42"
    number?: number;          // 42
    title?: string;           // "Add dark mode support"
    state?: string;           // "OPEN", "MERGED", "CLOSED"
    reviewDecision?: string | null;  // "APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"
    mergeable?: string | null;       // "MERGEABLE", "CONFLICTING", "UNKNOWN"
    checksStatus?: string;    // "pass", "fail", "pending"
    additions?: number;       // Lines added
    deletions?: number;       // Lines deleted
    changedFiles?: number;    // Number of files changed
  };

  // Plan progress (parsed from docs/plans/{feature}.md)
  planProgress?: {
    completed: number;        // Steps checked off (- [x])
    total: number;            // Total steps (checked + unchecked)
  };
}
```

### Response

```typescript
{ ok: true }
```

### Error Handling

If this call fails, a warning is logged but the agent exits normally. The spike result is always written to local files regardless of remote monitoring status.

### How PR Metadata Is Collected

After the agent finishes, the runner calls `gh pr view <url> --json number,title,state,reviewDecision,mergeable,statusCheckRollup,additions,deletions,changedFiles` on the VM. If the `gh` call fails (e.g., no PR exists yet), the `pr` field falls back to `{ url }` only.

The `checksStatus` field is derived from `statusCheckRollup`:
- `"fail"` — any check has conclusion `FAILURE` or `ERROR`
- `"pending"` — any check has status `IN_PROGRESS` or `QUEUED`
- `"pass"` — all checks passed

### How Plan Progress Is Collected

The runner reads `docs/plans/{feature}.md` and counts markdown checkboxes:
- Completed: lines matching `- [x]` (case-insensitive)
- Incomplete: lines matching `- [ ]`

---

## POST `/api/errors`

Called from CLI commands, the agent-runner, and harness scripts to report errors to a dedicated queryable table. This is separate from the `/api/runs/events` error events — those are ephemeral log entries, while `/api/errors` provides a persistent, indexed error store.

### Sources

- **CLI** (`source: "cli"`): Errors from `hatch feature`, `hatch spike`, `hatch clean`, `hatch new`
- **Agent** (`source: "agent"`): Top-level agent-runner crashes
- **Harness** (`source: "harness"`): UI capture failures read from `.harness/evidence/manifest.json` after agent completion

### Request Body

```typescript
{
  // Identity — which feature/project this error belongs to
  project: string;           // "my-app"
  feature: string;           // "add-dark-mode" or "initial-setup" (for hatch new)

  // Optional context
  vmName?: string;           // "peaceful-duckling"
  sshHost?: string;          // "peaceful-duckling.exe.xyz"
  runId?: string;            // Links to a run from /api/runs/start (agent-runner only)

  // Error classification
  source: "cli" | "agent" | "harness";
  command?: string;          // "feature", "spike", "clean", "new", "ui-capture"
  step?: string;             // "ssh-install", "convex-preview", "continuation", route path
  message: string;           // Human-readable error message
  stack?: string;            // Stack trace (when available)
  severity: "error" | "warning";
  timestamp: string;         // ISO 8601

  // Arbitrary extra data
  metadata?: Record<string, unknown>;  // e.g. { url, screenshot } for UI capture errors
}
```

### Response

```typescript
{ ok: true }
```

### Error Handling

All callers treat `/api/errors` failures as non-fatal:
- CLI commands use fire-and-forget (`.catch(() => {})`)
- Agent-runner wraps in a try/catch that silently swallows failures
- Errors are always logged locally regardless of whether the POST succeeds

### Design Notes

- **Indexed by `(project, feature)`** — the dashboard can show all errors for a given spike
- **`runId`** links back to the run timeline when the error comes from the agent-runner
- **UI capture errors** are surfaced here because the capture script itself doesn't have monitor credentials — the agent-runner reads the manifest post-run and reports on its behalf

---

## Dashboard Data Mapping

With these four endpoints, a dashboard can power:

| Panel | Data Source |
|-------|-------------|
| Active Spikes | Runs where status has no `/complete` yet |
| Live Event Feed | Events from `/events` — tool-by-tool progress |
| Cost Ticker | `costSnapshot` on latest event — live-updating |
| Plan Progress | `planProgress` from `/complete` — percentage bar |
| PR Status | Snapshot from `/complete` + backend polls GitHub for ongoing updates |
| Project Overview | Group runs by `project` — total cost, active count |
| GitHub Links | `github.repoUrl` + branch — direct links to code |
| Deployment Links | `vercelUrl`, `convexPreviewDeployment` — preview links |
| History | Completed runs with cost, duration, PR links |
| Iteration Timeline | `previousIterations` — how a feature evolved |
| Error Log | `/api/errors` — filterable by project, feature, source |
