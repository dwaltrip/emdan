import { Profiler, type ReactNode } from 'react';

import { session } from '@/session/session-instance';

import { PERF_DEBUG, perfLog } from './perf-log';

function onBoardRender(
  _id: string,
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
  baseDuration: number,
): void {
  if (phase === 'mount') return;
  const tick = session.store.state.game.tick;
  perfLog.event('reactCommit', tick, { ms: actualDuration, base: baseDuration });
}

function BoardProfiler({ children }: { children: ReactNode }) {
  if (!PERF_DEBUG) return children;
  return (
    <Profiler id="board" onRender={onBoardRender}>
      {children}
    </Profiler>
  );
}

export { BoardProfiler };
