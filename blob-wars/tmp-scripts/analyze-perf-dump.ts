// Analyze perf JSON dumps produced by ui/src/lib/perf-log.ts.
// Run from blob-wars/: `pnpm tsx tmp-scripts/analyze-perf-dump.ts <player1.json> [player2.json]`
//
// Reproduces the manual jq passes from the 4.24 freeze investigation:
//   - per-file metadata
//   - record-type breakdown
//   - simulating-phase quantiles for wsRecvToPaint / commitMs / tileRenders / changed
//   - top frame drifts overall + simulating-only
//   - simulating outliers (wsRecvToPaint > 50ms)
//   - focus/blur events during simulating
//   - side-by-side comparison table (when two files supplied)

import { readFileSync } from "node:fs";
import { basename } from "node:path";

// Types mirror PerfRecord in ui/src/lib/perf-log.ts. Inlined here so the
// script doesn't pull in DOM lib types via cross-module type checking.

interface BaseRecord {
  t: number;
  wallTime: string;
}

interface TickRecord extends BaseRecord {
  type: "tick";
  tick: number | string;
  phase: string | null;
  matchId: string | null;
  seat: string | null;
  visibilityState: string | null;
  hasFocus: boolean | null;
  wsRecvToPipeStart: number | null;
  derive: number | null;
  diff: number | null;
  pipeEndToCommit: number | null;
  commitMs: number | null;
  commitBase: number | null;
  commitToPaint: number | null;
  wsRecvToPaint: number | null;
  changed: number | null;
  total: number | null;
  newlyOccupied: number | null;
  tileRenders: number;
}

interface LongTaskRecord extends BaseRecord {
  type: "longtask";
  durationMs: number;
  startTime: number;
}

interface FrameDriftRecord extends BaseRecord {
  type: "frameDrift";
  driftMs: number;
}

interface FocusRecord extends BaseRecord {
  type: "focus";
  visibilityState: string;
  hasFocus: boolean;
}

interface BlurRecord extends BaseRecord {
  type: "blur";
  visibilityState: string;
  hasFocus: boolean;
}

interface VisibilityChangeRecord extends BaseRecord {
  type: "visibility";
  visibilityState: string;
  hasFocus: boolean;
}

interface MarkerRecord extends BaseRecord {
  type: "marker";
  reason: string;
}

type PerfRecord =
  | TickRecord
  | LongTaskRecord
  | FrameDriftRecord
  | FocusRecord
  | BlurRecord
  | VisibilityChangeRecord
  | MarkerRecord;

interface Dump {
  reason: string;
  dumpedAt: string;
  matchId: string | null;
  seat: string | null;
  bufferCap: number;
  bufferCapHit: boolean;
  recordCount: number;
  records: PerfRecord[];
}

const SIM_OUTLIER_MS = 50;
const TOP_DRIFTS = 5;

function loadDump(path: string): Dump {
  const text = readFileSync(path, "utf8");
  return JSON.parse(text) as Dump;
}

function quantile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

function fmt(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function pad(s: string, width: number): string {
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}

function padLeft(s: string, width: number): string {
  if (s.length >= width) return s;
  return " ".repeat(width - s.length) + s;
}

interface Stats {
  n: number;
  p50: number | null;
  p90: number | null;
  p99: number | null;
  max: number | null;
  over50: number;
  over100: number;
}

function stats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    p99: quantile(sorted, 0.99),
    max: sorted.length > 0 ? sorted[sorted.length - 1] : null,
    over50: values.filter((v) => v > 50).length,
    over100: values.filter((v) => v > 100).length,
  };
}

function header(s: string): void {
  console.log("\n" + s);
  console.log("─".repeat(s.length));
}

function ticksOf(records: PerfRecord[]): TickRecord[] {
  return records.filter((r): r is TickRecord => r.type === "tick");
}

function driftsOf(records: PerfRecord[]): FrameDriftRecord[] {
  return records.filter((r): r is FrameDriftRecord => r.type === "frameDrift");
}

function analyzeOne(path: string, dump: Dump): void {
  console.log("=".repeat(70));
  console.log(`FILE: ${basename(path)}`);
  console.log(`  matchId=${dump.matchId} seat=${dump.seat} reason=${dump.reason}`);
  console.log(`  records=${dump.recordCount} bufferCapHit=${dump.bufferCapHit}`);

  const records = dump.records;
  const ticks = ticksOf(records);
  const sim = ticks.filter((t) => t.phase === "simulating");
  const placing = ticks.filter((t) => t.phase === "placing");

  if (records.length > 0) {
    const first = records[0].t;
    const last = records[records.length - 1].t;
    console.log(`  duration=${((last - first) / 1000).toFixed(1)}s`);
  }

  // Record types
  header("Record types");
  const typeCounts = new Map<string, number>();
  for (const r of records) {
    typeCounts.set(r.type, (typeCounts.get(r.type) ?? 0) + 1);
  }
  for (const [type, count] of [...typeCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(type, 14)} ${count}`);
  }

  // Tick phases
  header("Tick phases");
  const phaseCounts = new Map<string, number>();
  for (const t of ticks) {
    const k = t.phase ?? "(null)";
    phaseCounts.set(k, (phaseCounts.get(k) ?? 0) + 1);
  }
  for (const [phase, count] of [...phaseCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(phase, 14)} ${count}`);
  }

  // Simulating quantiles
  header("Simulating-phase quantiles");
  const simWspToPaint = sim.map((t) => t.wsRecvToPaint).filter((v): v is number => v !== null);
  const simCommit = sim.map((t) => t.commitMs).filter((v): v is number => v !== null);
  const simCommitToPaint = sim.map((t) => t.commitToPaint).filter((v): v is number => v !== null);
  const simTileRenders = sim.map((t) => t.tileRenders);
  const simChanged = sim.map((t) => t.changed).filter((v): v is number => v !== null);

  const cols = ["metric", "n", "p50", "p90", "p99", "max", ">50ms", ">100ms"];
  console.log("  " + cols.map((c, i) => (i === 0 ? pad(c, 18) : padLeft(c, 8))).join(""));
  function row(label: string, s: Stats): void {
    const cells = [
      pad(label, 18),
      padLeft(String(s.n), 8),
      padLeft(fmt(s.p50), 8),
      padLeft(fmt(s.p90), 8),
      padLeft(fmt(s.p99), 8),
      padLeft(fmt(s.max), 8),
      padLeft(String(s.over50), 8),
      padLeft(String(s.over100), 8),
    ];
    console.log("  " + cells.join(""));
  }
  row("wsRecv→paint ms", stats(simWspToPaint));
  row("commitMs", stats(simCommit));
  row("commit→paint ms", stats(simCommitToPaint));
  row("tileRenders", stats(simTileRenders));
  row("changed", stats(simChanged));

  // Placing commits (short summary)
  if (placing.length > 0) {
    const placingCommits = placing.map((t) => t.commitMs).filter((v): v is number => v !== null);
    if (placingCommits.length > 0) {
      header("Placing-phase commits");
      const s = stats(placingCommits);
      console.log(`  n=${s.n}  p50=${fmt(s.p50)}ms  p90=${fmt(s.p90)}ms  max=${fmt(s.max)}ms`);
    }
  }

  // Top drifts overall
  const drifts = driftsOf(records);
  header(`Top ${TOP_DRIFTS} frame drifts (all phases)`);
  if (drifts.length === 0) {
    console.log("  (none)");
  } else {
    const sorted = [...drifts].sort((a, b) => b.driftMs - a.driftMs);
    for (const d of sorted.slice(0, TOP_DRIFTS)) {
      console.log(`  ${fmt(d.driftMs)}ms at t=${fmt(d.t, 0)}  (${d.wallTime})`);
    }
  }

  // Top drifts during simulating
  if (sim.length > 0) {
    const simStart = sim[0].t;
    const simEnd = sim[sim.length - 1].t;
    const simDrifts = drifts.filter((d) => d.t >= simStart && d.t <= simEnd);
    header(`Top ${TOP_DRIFTS} frame drifts during simulating`);
    if (simDrifts.length === 0) {
      console.log("  (none)");
    } else {
      const sorted = [...simDrifts].sort((a, b) => b.driftMs - a.driftMs);
      for (const d of sorted.slice(0, TOP_DRIFTS)) {
        console.log(`  ${fmt(d.driftMs)}ms at t=${fmt(d.t, 0)}`);
      }
    }
  }

  // Simulating outliers
  header(`Simulating ticks with wsRecvToPaint > ${SIM_OUTLIER_MS}ms`);
  const outliers = sim.filter((t) => (t.wsRecvToPaint ?? 0) > SIM_OUTLIER_MS);
  if (outliers.length === 0) {
    console.log("  (none)");
  } else {
    for (const t of outliers) {
      console.log(
        `  tick=${t.tick} wsRecv→paint=${fmt(t.wsRecvToPaint)}ms commit=${fmt(t.commitMs)}ms ` +
          `tileRenders=${t.tileRenders} changed=${t.changed} hasFocus=${t.hasFocus}`,
      );
    }
  }

  // Focus/blur during simulating
  if (sim.length > 0) {
    const simStart = sim[0].t;
    const simEnd = sim[sim.length - 1].t;
    const focusEvents = records.filter(
      (r) => (r.type === "focus" || r.type === "blur") && r.t >= simStart && r.t <= simEnd,
    );
    header("Focus/blur during simulating");
    if (focusEvents.length === 0) {
      console.log("  (none)");
    } else {
      for (const e of focusEvents) {
        if (e.type !== "focus" && e.type !== "blur") continue;
        console.log(
          `  ${pad(e.type, 6)} t=${fmt(e.t, 0)} visibility=${e.visibilityState} hasFocus=${e.hasFocus}`,
        );
      }
    }
  }
}

interface ComparisonRow {
  label: string;
  player1: number | null;
  player2: number | null;
  isCount: boolean;
}

function simDriftMax(dump: Dump, sim: TickRecord[]): number {
  if (sim.length === 0) return 0;
  const start = sim[0].t;
  const end = sim[sim.length - 1].t;
  const ds = driftsOf(dump.records).filter((d) => d.t >= start && d.t <= end);
  return ds.length ? Math.max(...ds.map((d) => d.driftMs)) : 0;
}

function compare(p1: Dump, p2: Dump): void {
  console.log("\n" + "=".repeat(70));
  console.log("SIDE-BY-SIDE COMPARISON (simulating phase only)");
  console.log("=".repeat(70));

  const sim1 = ticksOf(p1.records).filter((t) => t.phase === "simulating");
  const sim2 = ticksOf(p2.records).filter((t) => t.phase === "simulating");

  const wsp1 = stats(sim1.map((t) => t.wsRecvToPaint).filter((v): v is number => v !== null));
  const wsp2 = stats(sim2.map((t) => t.wsRecvToPaint).filter((v): v is number => v !== null));
  const cm1 = stats(sim1.map((t) => t.commitMs).filter((v): v is number => v !== null));
  const cm2 = stats(sim2.map((t) => t.commitMs).filter((v): v is number => v !== null));

  const drifts1 = driftsOf(p1.records);
  const drifts2 = driftsOf(p2.records);

  const rows: ComparisonRow[] = [
    { label: "ticks (sim)", player1: sim1.length, player2: sim2.length, isCount: true },
    { label: "wsRecv→paint p50", player1: wsp1.p50, player2: wsp2.p50, isCount: false },
    { label: "wsRecv→paint p99", player1: wsp1.p99, player2: wsp2.p99, isCount: false },
    { label: "wsRecv→paint max", player1: wsp1.max, player2: wsp2.max, isCount: false },
    { label: "commit p50", player1: cm1.p50, player2: cm2.p50, isCount: false },
    { label: "commit max", player1: cm1.max, player2: cm2.max, isCount: false },
    { label: "ticks > 50ms", player1: wsp1.over50, player2: wsp2.over50, isCount: true },
    { label: "ticks > 100ms", player1: wsp1.over100, player2: wsp2.over100, isCount: true },
    { label: "frameDrifts (all)", player1: drifts1.length, player2: drifts2.length, isCount: true },
    { label: "max drift in sim", player1: simDriftMax(p1, sim1), player2: simDriftMax(p2, sim2), isCount: false },
  ];

  const seat1 = p1.seat ?? "p1";
  const seat2 = p2.seat ?? "p2";
  console.log("\n  " + pad("metric", 22) + padLeft(seat1, 12) + padLeft(seat2, 12));
  console.log("  " + "─".repeat(46));
  for (const r of rows) {
    const cell = (v: number | null): string => {
      if (v === null) return "—";
      if (r.isCount) return String(v);
      return fmt(v) + "ms";
    };
    console.log("  " + pad(r.label, 22) + padLeft(cell(r.player1), 12) + padLeft(cell(r.player2), 12));
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2) {
    console.error(
      "usage: pnpm tsx tmp-scripts/analyze-perf-dump.ts <player1.json> [player2.json]",
    );
    process.exit(1);
  }

  const dumps = args.map((p) => ({ path: p, dump: loadDump(p) }));
  for (const { path, dump } of dumps) {
    analyzeOne(path, dump);
  }
  if (dumps.length === 2) {
    compare(dumps[0].dump, dumps[1].dump);
  }
}

main();
