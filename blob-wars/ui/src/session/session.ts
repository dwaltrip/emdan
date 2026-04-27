import type {
  ClientMessage,
  MatchSnapshot,
  ServerMessage,
  WantOpponent,
} from '@shared/protocol';

import { createActions, type BoardStoreInstance } from '@/board-store';
import { perfLog } from '@/lib/perf-log';

interface SessionDeps {
  store: BoardStoreInstance;
  send: (msg: ClientMessage) => void;
}

interface Session {
  store: BoardStoreInstance;
  handleMessage: (msg: ServerMessage) => void;
  handleOpen: () => void;
  handleClose: () => void;
  plant: (x: number, y: number) => void;
  canPlant: () => boolean;
  joinLobby: (wantOpponent: WantOpponent) => void;
}

function createSession({ store, send }: SessionDeps): Session {
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
      case 'error':
        return;
      case 'lobbyUpdate':
        actions.setWaitingFor(msg.waitingFor);
        return;
      case 'matchStarted':
        actions.setWaitingFor(null);
        actions.setOpponentRole(msg.opponentRole);
        applyIncoming(msg.state);
        return;
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

  function joinLobby(wantOpponent: WantOpponent): void {
    send({ type: 'joinLobby', role: 'human', wantOpponent });
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

export type { Session };
export { createSession };
