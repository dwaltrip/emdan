import type {
  ClientMessage,
  MatchSnapshot,
  ServerMessage,
} from '@shared/protocol';

import { createActions, type BlobWarsBoardStoreInstance } from '@/board-store';
import { perfLog } from '@/lib/perf-log';

interface SessionDeps {
  store: BlobWarsBoardStoreInstance;
  send: (msg: ClientMessage) => void;
}

interface BlobWarsSession {
  store: BlobWarsBoardStoreInstance;
  handleMessage: (msg: ServerMessage) => void;
  handleOpen: () => void;
  handleClose: () => void;
  plant: (x: number, y: number) => void;
  canPlant: () => boolean;
  joinLobby: () => void;
}

function createBlobWarsSession({ store, send }: SessionDeps): BlobWarsSession {
  const actions = createActions(store);
  let currentMatchId: string | null = null;

  function applyIncoming(snapshot: MatchSnapshot): void {
    if (snapshot.matchId !== currentMatchId) {
      store.reset(snapshot.board.width, snapshot.board.height);
      currentMatchId = snapshot.matchId;
    }
    actions.applySnapshot(snapshot);
  }

  function handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome':
      case 'lobbyUpdate':
      case 'error':
        return;
      case 'matchStarted':
      case 'stateUpdate':
        applyIncoming(msg.state);
        return;
      case 'matchEnded':
        applyIncoming(msg.state);
        // Auto-dump the perf buffer at match end so the tester gets a JSON
        // file without DevTools. rAF-deferred to let this final snapshot
        // flush its `paint` event into the buffer before we serialize.
        requestAnimationFrame(() => perfLog.dump('matchEnded'));
        return;
    }
  }

  function handleOpen(): void {
    actions.setConnectionStatus('connected');
  }

  function handleClose(): void {
    actions.setConnectionStatus('disconnected');
  }

  function plant(x: number, y: number): void {
    if (!canPlant()) return;
    send({ type: 'plantSeed', x, y });
  }

  function joinLobby(): void {
    send({ type: 'joinLobby' });
  }

  function canPlant(): boolean {
    const { game, connectionStatus } = store.state;
    const seat = game.currentUser.seat;
    if (connectionStatus !== 'connected') return false;
    if (seat === null) return false;
    if (game.phase !== 'placing') return false;
    if (game.currentTurn !== seat) return false;
    return game.players[seat].seedsRemaining > 0;
  }

  return {
    store,
    handleMessage,
    handleOpen,
    handleClose,
    plant,
    canPlant,
    joinLobby,
  };
}

export type { BlobWarsSession };
export { createBlobWarsSession };
