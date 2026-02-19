export function generateQueryLogsScript(): string {
	return `#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const LOG_DIR = join(homedir(), ".harness", "logs");
const LOG_FILE = join(LOG_DIR, "app.jsonl");

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--level" && args[i + 1]) {
      flags.level = args[++i];
    } else if (arg === "--route" && args[i + 1]) {
      flags.route = args[++i];
    } else if (arg === "--since" && args[i + 1]) {
      flags.since = args[++i];
    } else if (arg === "--slow" && args[i + 1]) {
      flags.slow = Number(args[++i]);
    } else if (arg === "--limit" && args[i + 1]) {
      flags.limit = Number(args[++i]);
    } else if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--summary") {
      flags.summary = true;
    } else if (arg === "--clear") {
      flags.clear = true;
    }
  }
  return flags;
}

function parseSinceDuration(since) {
  const match = since.match(/^(\\d+)(s|m|h)$/);
  if (!match) {
    console.error("Invalid --since format. Use e.g. 5m, 1h, 30s");
    process.exit(1);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000 };
  return Date.now() - value * multipliers[unit];
}

function readLogs() {
  if (!existsSync(LOG_FILE)) {
    return [];
  }
  const content = readFileSync(LOG_FILE, "utf-8").trim();
  if (!content) return [];
  return content.split("\\n").map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function formatEntry(entry) {
  const ts = entry.timestamp || "";
  const level = (entry.level || "info").toUpperCase().padEnd(5);
  const method = entry.method || "";
  const route = entry.route || "";
  const status = entry.statusCode != null ? String(entry.statusCode) : "";
  const duration = entry.durationMs != null ? entry.durationMs + "ms" : "";
  const message = entry.message || "";

  const parts = [ts, level];
  if (method && route) {
    parts.push(method + " " + route);
  }
  if (status) parts.push(status);
  if (duration) parts.push(duration);
  parts.push(message);

  return parts.join(" | ");
}

const flags = parseArgs();

if (flags.clear) {
  if (existsSync(LOG_FILE)) {
    writeFileSync(LOG_FILE, "");
    console.log("Logs cleared.");
  } else {
    console.log("No log file to clear.");
  }
  process.exit(0);
}

let entries = readLogs();

if (entries.length === 0) {
  console.log("No log entries found.");
  if (!existsSync(LOG_FILE)) {
    console.log("Log file does not exist yet: " + LOG_FILE);
  }
  process.exit(0);
}

// Apply filters
if (flags.level) {
  entries = entries.filter((e) => e.level === flags.level);
}

if (flags.route) {
  entries = entries.filter((e) => e.route && e.route.includes(flags.route));
}

if (flags.since) {
  const cutoff = parseSinceDuration(flags.since);
  entries = entries.filter((e) => e.timestamp && new Date(e.timestamp).getTime() >= cutoff);
}

if (flags.slow) {
  entries = entries.filter((e) => e.durationMs != null && e.durationMs > flags.slow);
}

// Summary mode
if (flags.summary) {
  const routes = {};
  for (const entry of entries) {
    const key = (entry.method || "?") + " " + (entry.route || "unknown");
    if (!routes[key]) {
      routes[key] = { count: 0, totalDuration: 0, errors: 0 };
    }
    routes[key].count++;
    if (entry.durationMs != null) {
      routes[key].totalDuration += entry.durationMs;
    }
    if (entry.level === "error") {
      routes[key].errors++;
    }
  }

  if (flags.json) {
    const summary = Object.entries(routes).map(([route, stats]) => ({
      route,
      count: stats.count,
      avgDurationMs: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0,
      errors: stats.errors,
    }));
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log("Route Summary (" + entries.length + " entries)\\n");
    console.log("Route".padEnd(50) + "Count".padEnd(8) + "Avg ms".padEnd(10) + "Errors");
    console.log("-".repeat(75));
    for (const [route, stats] of Object.entries(routes)) {
      const avg = stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0;
      console.log(
        route.padEnd(50) +
        String(stats.count).padEnd(8) +
        String(avg).padEnd(10) +
        String(stats.errors)
      );
    }
  }
  process.exit(0);
}

// Apply limit (default 50)
const limit = flags.limit || 50;
entries = entries.slice(-limit);

if (flags.json) {
  console.log(JSON.stringify(entries, null, 2));
} else {
  for (const entry of entries) {
    console.log(formatEntry(entry));
  }
  console.log("\\n(" + entries.length + " entries shown)");
}
`;
}
