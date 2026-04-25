import { perfLog } from '@/lib/perf-log';

import { initSession } from './session-lifecycle';

const DEFAULT_WS_PORT = import.meta.env.VITE_WS_PORT ?? '3002';
const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL ?? getDefaultWsUrl(DEFAULT_WS_PORT);

// NOTE: intentional import-time side effect. The session is a module-level
// singleton that owns its own socket and outlives any React mount — the whole
// point of the perf refactor. HMR dispose tears down the old socket before
// the module is replaced; without it dev reloads would pile up phantom
// connections. Non-browser importers (tests, node scripts) should import
// `session.ts` / `game-socket.ts` directly instead of this file.
const handle = initSession(DEFAULT_WS_URL);

perfLog.setContextProvider(() => {
  const { game } = handle.session.store.state;
  return {
    phase: game.phase,
    matchId: game.matchId,
    seat: game.currentUser.seat,
  };
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => handle.end());
}

export const session = handle.session;

function getDefaultWsUrl(port: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:${port}`;
}
