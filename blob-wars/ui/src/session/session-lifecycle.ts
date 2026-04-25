import { GRID_HEIGHT, GRID_WIDTH } from '@shared/protocol';

import { createBlobWarsBoardStore } from '@/board-store';

import { createGameSocket } from './game-socket';
import { createBlobWarsSession, type BlobWarsSession } from './session';

interface SessionHandle {
  session: BlobWarsSession;
  end: () => void;
}

function initSession(url: string): SessionHandle {
  const store = createBlobWarsBoardStore(GRID_WIDTH, GRID_HEIGHT);

  // Forward-referenced so socket callbacks can dispatch to the session.
  // Safe: WS callbacks only fire after `session` is assigned below.
  let session: BlobWarsSession | null = null;
  const getSession = (): BlobWarsSession => {
    if (!session) throw new Error('[session-lifecycle] session used before init');
    return session;
  };

  const socket = createGameSocket(url, {
    onOpen: () => getSession().handleOpen(),
    onClose: () => getSession().handleClose(),
    onMessage: (msg) => getSession().handleMessage(msg),
  });

  session = createBlobWarsSession({ store, send: socket.send });

  return { session, end: () => socket.close() };
}

export type { SessionHandle };
export { initSession };
