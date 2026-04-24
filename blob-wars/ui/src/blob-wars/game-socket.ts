import {
  type ClientMessage,
  type ServerMessage,
  parseServerMessage,
  serializeClientMessage,
} from '@shared/protocol';

import { perfLog } from '@/lib/perf-log';

interface GameSocketCallbacks {
  onOpen: () => void;
  onClose: () => void;
  onMessage: (msg: ServerMessage) => void;
}

interface GameSocketHandle {
  send: (msg: ClientMessage) => void;
  close: () => void;
}

function createGameSocket(
  url: string,
  { onOpen, onClose, onMessage }: GameSocketCallbacks,
): GameSocketHandle {
  const socket = new WebSocket(url);

  socket.addEventListener('open', onOpen);
  socket.addEventListener('close', onClose);
  socket.addEventListener('error', () => {
    console.error('[game-socket] socket error');
  });
  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return;
    const parsed = parseServerMessage(event.data);
    if (!parsed) {
      console.warn('[game-socket] unparsed payload', event.data);
      return;
    }
    if ('state' in parsed) {
      perfLog.event('wsRecv', parsed.state.tick);
    }
    onMessage(parsed);
  });

  function send(msg: ClientMessage): void {
    if (socket.readyState !== WebSocket.OPEN) {
      console.warn('[game-socket] send while not open', msg);
      return;
    }
    socket.send(serializeClientMessage(msg));
  }

  function close(): void {
    socket.close();
  }

  return { send, close };
}

export type { GameSocketCallbacks, GameSocketHandle };
export { createGameSocket };
