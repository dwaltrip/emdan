// Domain wiring for blob-wars perf instrumentation.
//
// Wires the generic recorder to a single-line formatter, configures `paint`
// as the closing event, and exposes a narrow callsite API. Replace or
// augment the formatter without touching call sites or the recorder lib.

import type { RecorderEvent } from './perf-recorder';
import { createRecorder } from './perf-recorder';

let lastLogAt: number | null = null;
let tileRenderCount = 0;

function bumpTileRender(): void {
  tileRenderCount++;
}

function drainTileRenders(): number {
  const c = tileRenderCount;
  tileRenderCount = 0;
  return c;
}

function formatTickLine(key: string | number, events: RecorderEvent[]): void {
  const byName = new Map(events.map((e) => [e.name, e]));

  const gap = (a: string, b: string): string => {
    const ea = byName.get(a);
    const eb = byName.get(b);
    if (!ea || !eb) return '?';
    return (eb.at - ea.at).toFixed(1);
  };
  const dur = (name: string): string => {
    const e = byName.get(name);
    return e?.dur !== undefined ? e.dur.toFixed(1) : '?';
  };
  const field = (name: string, k: string): string => {
    const v = byName.get(name)?.data?.[k];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '?';
  };

  const now = performance.now();
  const delta = lastLogAt === null ? 0 : now - lastLogAt;
  lastLogAt = now;
  const tileRenders = drainTileRenders();

  console.log(
    `[${formatTimestamp(new Date())} +${delta.toFixed(0).padStart(4, ' ')}ms] ` +
      `tick=${key} ` +
      `wsRecv→pipeStart=${gap('wsRecv', 'pipeStart')} ` +
      `derive=${dur('derive')} diff=${dur('diff')} ` +
      `pipeEnd→paint=${gap('pipeEnd', 'paint')}ms ` +
      `changed=${field('pipeEnd', 'changed')}/${field('pipeEnd', 'total')} ` +
      `occupied=+${field('pipeEnd', 'newlyOccupied')} ` +
      `tileRenders=${tileRenders}`,
  );
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

const perfLog = {
  event: recorder.event,
  timed: recorder.timed,
  rAFEvent,
  bumpTileRender,
};

export { perfLog };
