// Domain wiring for blob-wars perf instrumentation.
//
// Wires the generic recorder to a single-line console formatter, configures
// `paint` as the closing event, and maintains an in-memory structured buffer
// for offline analysis. Records are dumped as JSON: automatically on
// matchEnded (wired by the session) and beforeunload, or manually via
// window.__perfDump().
//
// Gated on `?perfDebug` URL param. When absent (default dev), all exported
// perfLog functions are no-ops and no observers are installed. Required so
// the measurement apparatus itself doesn't affect hover/render latency
// during normal development.

import type { RecorderEvent } from './perf-recorder';
import { createRecorder } from './perf-recorder';

const PERF_DEBUG =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('perfDebug');

let lastLogAt: number | null = null;

// --- Structured record buffer ---

interface PerfContext {
  phase: string | null;
  matchId: string | null;
  seat: string | null;
}

interface BaseRecord {
  t: number;
  wallTime: string;
}

interface TickRecord extends BaseRecord {
  type: 'tick';
  tick: number | string;
  phase: string | null;
  matchId: string | null;
  seat: string | null;
  visibilityState: DocumentVisibilityState | null;
  hasFocus: boolean | null;
  wsRecvToPipeStart: number | null;
  derive: number | null;
  diff: number | null;
  canvasDraw: number | null;
  wsRecvToPaint: number | null;
  changed: number | null;
  total: number | null;
  newlyOccupied: number | null;
}

interface LongTaskRecord extends BaseRecord {
  type: 'longtask';
  durationMs: number;
  startTime: number;
}

interface FrameDriftRecord extends BaseRecord {
  type: 'frameDrift';
  driftMs: number;
}

interface VisibilityRecord extends BaseRecord {
  type: 'visibility' | 'focus' | 'blur';
  visibilityState: DocumentVisibilityState;
  hasFocus: boolean;
}

interface MarkerRecord extends BaseRecord {
  type: 'marker';
  reason: string;
}

type PerfRecord =
  | TickRecord
  | LongTaskRecord
  | FrameDriftRecord
  | VisibilityRecord
  | MarkerRecord;

const BUFFER_CAP = 1000;
const records: PerfRecord[] = [];
let bufferCapWarned = false;

function pushRecord(rec: PerfRecord): void {
  if (records.length >= BUFFER_CAP) {
    if (!bufferCapWarned) {
      console.warn(`[perfLog] buffer cap (${BUFFER_CAP}) reached; dropping new records`);
      bufferCapWarned = true;
    }
    return;
  }
  records.push(rec);
}

let contextProvider: (() => PerfContext) | null = null;

function setContextProvider(fn: () => PerfContext): void {
  contextProvider = fn;
}

function getContext(): PerfContext {
  if (!contextProvider) return { phase: null, matchId: null, seat: null };
  try {
    return contextProvider();
  } catch {
    return { phase: null, matchId: null, seat: null };
  }
}

function getVisibility(): { visibilityState: DocumentVisibilityState | null; hasFocus: boolean | null } {
  if (typeof document === 'undefined') return { visibilityState: null, hasFocus: null };
  return { visibilityState: document.visibilityState, hasFocus: document.hasFocus() };
}

// --- Tick log + structured tick record ---

function formatTickLine(key: string | number, events: RecorderEvent[]): void {
  const byName = new Map(events.map((e) => [e.name, e]));

  // No `wsRecv` means this flush wasn't driven by a real pipeline cycle
  // (e.g. a stray closing event with an empty buffer). Skip — logging it
  // produces an all-`?` line and an all-null record.
  if (!byName.has('wsRecv')) return;

  const gapMs = (a: string, b: string): number | null => {
    const ea = byName.get(a);
    const eb = byName.get(b);
    if (!ea || !eb) return null;
    return eb.at - ea.at;
  };
  const durMs = (name: string): number | null => byName.get(name)?.dur ?? null;
  const numField = (name: string, k: string): number | null => {
    const v = byName.get(name)?.data?.[k];
    return typeof v === 'number' ? v : null;
  };

  const fmt = (v: number | null, digits = 1): string =>
    v === null ? '?' : v.toFixed(digits);

  const now = performance.now();
  const delta = lastLogAt === null ? 0 : now - lastLogAt;
  lastLogAt = now;

  const wsRecvToPipeStart = gapMs('wsRecv', 'pipeStart');
  const derive = durMs('derive');
  const diff = durMs('diff');
  const canvasDraw = durMs('canvasDraw');
  const wsRecvToPaint = gapMs('wsRecv', 'paint');
  const changed = numField('pipeEnd', 'changed');
  const total = numField('pipeEnd', 'total');
  const newlyOccupied = numField('pipeEnd', 'newlyOccupied');

  console.log(
    `[${formatTimestamp(new Date())} +${delta.toFixed(0).padStart(4, ' ')}ms] ` +
      `tick=${key} ` +
      `wsRecv→pipeStart=${fmt(wsRecvToPipeStart)} ` +
      `derive=${fmt(derive)} diff=${fmt(diff)} ` +
      `canvasDraw=${fmt(canvasDraw)} ` +
      `wsRecv→paint=${fmt(wsRecvToPaint)}ms ` +
      `changed=${changed ?? '?'}/${total ?? '?'} ` +
      `occupied=+${newlyOccupied ?? '?'}`,
  );

  const ctx = getContext();
  const vis = getVisibility();
  pushRecord({
    type: 'tick',
    t: now,
    wallTime: new Date().toISOString(),
    tick: key,
    phase: ctx.phase,
    matchId: ctx.matchId,
    seat: ctx.seat,
    visibilityState: vis.visibilityState,
    hasFocus: vis.hasFocus,
    wsRecvToPipeStart,
    derive,
    diff,
    canvasDraw,
    wsRecvToPaint,
    changed,
    total,
    newlyOccupied,
  });
}

function formatTimestamp(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

const recorder = createRecorder({
  closingEvent: 'paint',
  onFlush: formatTickLine,
});

function rAFEvent(name: string, key: string | number): void {
  requestAnimationFrame(() => recorder.event(name, key));
}

// --- Responsiveness monitors ---

const FRAME_DRIFT_THRESHOLD_MS = 10;
const FRAME_BUDGET_MS = 16.67;

function startLongTaskObserver(): void {
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Buffer-only: console.warn during a longtask can amplify the very
        // jank we're measuring (DevTools retains the buffer even when
        // closed). Inspect longtasks via the dumped JSON.
        pushRecord({
          type: 'longtask',
          t: performance.now(),
          wallTime: new Date().toISOString(),
          durationMs: entry.duration,
          startTime: entry.startTime,
        });
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
  } catch {
    // longtask entry type not supported; silently skip.
  }
}

function startFrameDriftMonitor(): void {
  if (typeof requestAnimationFrame === 'undefined') return;
  let last = performance.now();
  function frame(): void {
    const now = performance.now();
    const drift = now - last - FRAME_BUDGET_MS;
    if (drift > FRAME_DRIFT_THRESHOLD_MS) {
      // Buffer-only for the same reason as longtask above.
      pushRecord({
        type: 'frameDrift',
        t: now,
        wallTime: new Date().toISOString(),
        driftMs: drift,
      });
    }
    last = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function startVisibilityMonitor(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  function record(type: 'visibility' | 'focus' | 'blur'): void {
    const vis = getVisibility();
    if (vis.visibilityState === null || vis.hasFocus === null) return;
    pushRecord({
      type,
      t: performance.now(),
      wallTime: new Date().toISOString(),
      visibilityState: vis.visibilityState,
      hasFocus: vis.hasFocus,
    });
    console.log(`[${type}] visibilityState=${vis.visibilityState} hasFocus=${vis.hasFocus}`);
  }

  document.addEventListener('visibilitychange', () => record('visibility'));
  window.addEventListener('focus', () => record('focus'));
  window.addEventListener('blur', () => record('blur'));
}

// --- Dump ---

function dump(reason: string): void {
  if (typeof window === 'undefined') return;
  if (records.length === 0) return;

  pushRecord({
    type: 'marker',
    t: performance.now(),
    wallTime: new Date().toISOString(),
    reason,
  });

  const ctx = getContext();
  const payload = {
    reason,
    dumpedAt: new Date().toISOString(),
    matchId: ctx.matchId,
    seat: ctx.seat,
    bufferCap: BUFFER_CAP,
    bufferCapHit: bufferCapWarned,
    recordCount: records.length,
    records,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `perf-${ctx.matchId ?? 'no-match'}-${ctx.seat ?? 'no-seat'}-${stamp}.json`;

  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    console.log(`[perfLog] dumped ${records.length} records to ${filename} (reason=${reason})`);
  } catch (err) {
    console.error('[perfLog] dump failed', err);
  }
}

if (PERF_DEBUG && typeof window !== 'undefined') {
  startLongTaskObserver();
  startFrameDriftMonitor();
  startVisibilityMonitor();
  // Escape hatch for manual dumps from DevTools.
  (window as unknown as { __perfDump: (reason?: string) => void }).__perfDump =
    (reason = 'manual') => dump(reason);
  console.log('[perfLog] enabled via ?perfDebug');
}

const noopPerfLog = {
  event: (_name: string, _key: string | number, _data?: Record<string, unknown>) => {},
  timed: <T>(_name: string, _key: string | number, fn: () => T): T => fn(),
  rAFEvent: (_name: string, _key: string | number) => {},
  setContextProvider: (_fn: () => PerfContext) => {},
  dump: (_reason: string) => {},
};

const perfLog = PERF_DEBUG
  ? {
      event: recorder.event,
      timed: recorder.timed,
      rAFEvent,
      setContextProvider,
      dump,
    }
  : noopPerfLog;

export type { PerfContext, PerfRecord };
export { perfLog, PERF_DEBUG };
