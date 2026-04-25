import { GRID_HEIGHT, GRID_WIDTH } from '@shared/protocol';

import { createBoardStore } from '@/board-store';

import { createGameSocket } from './game-socket';
import { createSession, type Session } from './session';

interface SessionHandle {
  session: Session;
  end: () => void;
}

function initSession(url: string): SessionHandle {
  const store = createBoardStore(GRID_WIDTH, GRID_HEIGHT);

  // Forward-referenced so socket callbacks can dispatch to the session.
  // Safe: WS callbacks only fire after `session` is assigned below.
  let session: Session | null = null;
  const getSession = (): Session => {
    if (!session) throw new Error('[session-lifecycle] session used before init');
    return session;
  };

  const socket = createGameSocket(url, {
    onOpen: () => getSession().handleOpen(),
    onClose: () => getSession().handleClose(),
    onMessage: (msg) => getSession().handleMessage(msg),
  });

  session = createSession({ store, send: socket.send });

  return { session, end: () => socket.close() };
}

export type { SessionHandle };
export { initSession };
