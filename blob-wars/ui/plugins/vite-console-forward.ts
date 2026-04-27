/*
  Modified version of vite-console-forward-plugin that logs to a tmp file per-tab.
  The previous tmp files are auto-cleared each time vite dev server runs.
*/
import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";

interface Options {
  enabled?: boolean;
  endpoint?: string;
  levels?: Array<"log" | "warn" | "error" | "info" | "debug">;
  // Defaults to `<viteRoot>/tmp/browser-logs` when omitted. Relative paths resolve against viteRoot.
  outDir?: string;
}

interface IncomingLog {
  tabId?: string;
  level?: string;
  message?: string;
  timestamp?: string;
  stacks?: string[];
}

export function consoleForwardPlugin(options: Options = {}): Plugin {
  const {
    enabled = true,
    endpoint = "/api/debug/client-logs",
    levels = ["log", "warn", "error", "info", "debug"],
    outDir,
  } = options;

  const virtualModuleId = "virtual:console-forward";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  return {
    name: "console-forward-local",
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
      return undefined;
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (!enabled) return html;
        if (html.includes("virtual:console-forward")) return html;
        return html.replace(
          /<head[^>]*>/i,
          (match) =>
            `${match}\n    <script type="module">import "virtual:console-forward";</script>`,
        );
      },
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) return undefined;
      if (!enabled) return "export default {};";
      return clientCode(endpoint, levels);
    },
    configureServer(server) {
      const resolvedOutDir = outDir
        ? resolve(server.config.root, outDir)
        : join(server.config.root, "tmp", "browser-logs");
      rmSync(resolvedOutDir, { recursive: true, force: true });
      mkdirSync(resolvedOutDir, { recursive: true });
      const sessionStamp = formatSessionStamp(new Date());
      server.config.logger.info(
        `[console-forward] writing per-tab browser logs to ${resolvedOutDir}/${sessionStamp}_<tabId>.log`,
        { timestamp: true },
      );

      server.middlewares.use(endpoint, (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body) as { logs: IncomingLog[] };
            const grouped = new Map<string, string[]>();
            for (const log of parsed.logs ?? []) {
              const id = String(log.tabId ?? "unknown");
              const existing = grouped.get(id) ?? [];
              existing.push(formatLine(log));
              grouped.set(id, existing);
            }
            for (const [id, lines] of grouped) {
              appendFileSync(
                join(resolvedOutDir, `${sessionStamp}_${id}.log`),
                lines.join("\n") + "\n",
              );
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            server.config.logger.error(`[console-forward] ${msg}`, {
              timestamp: true,
            });
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          }
        });
      });
    },
  };
}

function formatSessionStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  );
}

function formatLine(log: IncomingLog): string {
  const ts = String(log.timestamp ?? "").slice(11, 23) || "--:--:--.---";
  const lvl = (log.level ?? "log").padEnd(5);
  let line = `${ts} ${lvl} ${log.message ?? ""}`;
  if (log.stacks && log.stacks.length > 0) {
    const indented = log.stacks
      .flatMap((s) => String(s).split("\n").map((l) => `    ${l}`))
      .join("\n");
    line += "\n" + indented;
  }
  return line;
}

function clientCode(endpoint: string, levels: string[]): string {
  return `
const originalMethods = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

let tabId = sessionStorage.getItem("__cf_tab_id");
if (!tabId) {
  tabId = Math.random().toString(36).slice(2, 8);
  sessionStorage.setItem("__cf_tab_id", tabId);
}

const logBuffer = [];
let flushTimeout = null;
const FLUSH_DELAY = 100;
const MAX_BUFFER_SIZE = 50;

function safeStringify(v) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

function createLogEntry(level, args) {
  const stacks = [];
  const parts = args.map((arg) => {
    if (arg === undefined) return "undefined";
    if (typeof arg === "string") return arg;
    if (arg instanceof Error || (arg && typeof arg.stack === "string")) {
      const stringified = String(arg);
      if (arg.stack) {
        let stack = String(arg.stack);
        if (stack.startsWith(stringified)) stack = stack.slice(stringified.length).trimStart();
        if (stack) stacks.push(stack);
      }
      return stringified;
    }
    if (typeof arg === "object" && arg !== null) return safeStringify(arg);
    return String(arg);
  });
  return {
    tabId,
    level,
    message: parts.join(" "),
    timestamp: new Date().toISOString(),
    stacks,
  };
}

async function sendLogs(logs) {
  try {
    await fetch("${endpoint}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs }),
    });
  } catch {}
}

function flushLogs() {
  if (logBuffer.length === 0) return;
  const out = logBuffer.splice(0);
  sendLogs(out);
  if (flushTimeout) { clearTimeout(flushTimeout); flushTimeout = null; }
}

function addToBuffer(entry) {
  logBuffer.push(entry);
  if (logBuffer.length >= MAX_BUFFER_SIZE) { flushLogs(); return; }
  if (!flushTimeout) flushTimeout = setTimeout(flushLogs, FLUSH_DELAY);
}
${levels
  .map(
    (l) => `
const __orig_${l} = originalMethods.${l};
console.${l} = function(...args) {
  __orig_${l}(...args);
  addToBuffer(createLogEntry("${l}", args));
};`,
  )
  .join("")}

window.addEventListener("beforeunload", flushLogs);
setInterval(flushLogs, 10000);

export default { flushLogs, tabId };
`;
}
