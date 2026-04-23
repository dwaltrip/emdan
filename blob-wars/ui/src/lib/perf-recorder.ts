// Generic per-key event recorder.
//
// Buffers events grouped by a correlation key. When an event whose name
// matches `closingEvent` arrives, the bundle for that key is drained and
// handed to `onFlush`. Knows nothing about its consumers' vocabulary.

interface RecorderEvent {
  name: string;
  at: number;
  dur?: number;
  data?: Record<string, unknown>;
}

interface RecorderOpts {
  closingEvent: string;
  onFlush: (key: string | number, events: RecorderEvent[]) => void;
  // Cap on simultaneously buffered keys; oldest is dropped when exceeded.
  // Protects against orphaned buffers when a closing event never arrives.
  maxPending?: number;
}

function createRecorder(opts: RecorderOpts) {
  const maxPending = opts.maxPending ?? 32;
  const buffers = new Map<string | number, RecorderEvent[]>();

  function push(key: string | number, evt: RecorderEvent): void {
    let buf = buffers.get(key);
    if (!buf) {
      if (buffers.size >= maxPending) {
        const oldest = buffers.keys().next().value;
        if (oldest !== undefined) buffers.delete(oldest);
      }
      buf = [];
      buffers.set(key, buf);
    }
    buf.push(evt);
    if (evt.name === opts.closingEvent) {
      buffers.delete(key);
      opts.onFlush(key, buf);
    }
  }

  function event(name: string, key: string | number, data?: Record<string, unknown>): void {
    push(key, { name, at: performance.now(), data });
  }

  function timed<T>(name: string, key: string | number, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    push(key, { name, at: start, dur: performance.now() - start });
    return result;
  }

  return { event, timed };
}

export type { RecorderEvent, RecorderOpts };
export { createRecorder };
