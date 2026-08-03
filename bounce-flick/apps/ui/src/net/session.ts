import type {
  BallPosition,
  GeneratedLevel,
  MatchEndReason,
  MatchWinner,
  PlayerSeat,
  ServerMessage,
} from '@shared/protocol';

import { createGameSocket, type GameSocketHandle } from './game-socket';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface LobbyStatus {
  playersConnected: number;
  requiredPlayers: number;
  ready: boolean;
}

export interface MatchResult {
  reason: MatchEndReason;
  winner: MatchWinner | null;
  times: Record<PlayerSeat, number | null>;
  seat: PlayerSeat | null;
}

export interface SessionState {
  status: ConnectionStatus;
  seat: PlayerSeat | null;
  lobby: LobbyStatus | null;
  // Server-generated level for the current match.
  level: GeneratedLevel | null;
  started: boolean;
  result: MatchResult | null;
}

// State that lives outside of the React render process.
// Live multiplayer game state. Rendered by `game.renderer`.
export interface LiveState {
  ghostBalls: BallPosition[];
}

export interface Session {
  live: LiveState;

  getState: () => SessionState;
  subscribe: (listener: () => void) => () => void;
  joinLobby: () => void;
  startNow: () => void;
  end: () => void;
  sendBall: (x: number, y: number) => void;
  reportFinish: (elapsedMs: number) => void;
}

export function createSession(url: string): Session {
  let state: SessionState = {
    status: 'connecting',
    seat: null,
    lobby: null,
    level: null,
    started: false,
    result: null,
  };
  const listeners = new Set<() => void>();
  const live: LiveState = { ghostBalls: [] };

  function setState(patch: Partial<SessionState>): void {
    state = { ...state, ...patch };
    for (const listener of listeners) {
      listener();
    }
  }

  let socket: GameSocketHandle;

  function handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        setState({ seat: message.seat });
        return;
      case 'lobby-update':
        setState({
          lobby: {
            playersConnected: message.playersConnected,
            requiredPlayers: message.requiredPlayers,
            ready: message.ready,
          },
        });
        return;
      case 'game-level':
        setState({ level: message.level });
        return;
      case 'start-game':
        setState({ started: true });
        return;
      case 'state-update': {
        // Multiplayer game updates. Rendered to game canvas, no React.
        live.ghostBalls = Object.entries(message.positions).flatMap(([seat, position]) => {
          if (seat === state.seat || position === null) {
            return [];
          }

          return [position];
        });
        return;
      }
      case 'match-ended':
        live.ghostBalls = [];
        setState({
          result: {
            reason: message.reason,
            winner: message.winner,
            times: message.times,
            seat: state.seat,
          },
          seat: null,
          lobby: null,
          level: null,
          started: false,
        });
        return;
      case 'error':
        console.warn('[session] server error', message.code, message.message);
        return;
    }
  }

  socket = createGameSocket(url, {
    onOpen: () => setState({ status: 'connected' }),
    onClose: () => setState({ status: 'disconnected' }),
    onMessage: handleMessage,
  });

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    joinLobby: () => {
      setState({ result: null });
      socket.send({ type: 'join-lobby' });
    },
    startNow: () => socket.send({ type: 'start-now' }),
    end: () => socket.close(),
    live,
    sendBall: (x, y) => socket.send({ type: 'ball-update', x, y }),
    reportFinish: (elapsedMs) => socket.send({ type: 'player-finished', elapsedMs }),
  };
}
