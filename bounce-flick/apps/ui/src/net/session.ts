import type { GeneratedLevel, MatchOutcome, PlayerSeat, ServerMessage } from '@shared/protocol';
import type { Point } from '@shared/level';

import { createGameSocket, type GameSocketHandle } from './game-socket';

export type MatchResult = {
  outcome: MatchOutcome;
  seat: PlayerSeat;
};

export type JoinState =
  | { phase: 'connecting' }
  | { phase: 'disconnected' }
  | { phase: 'idle' }
  | { phase: 'lobby'; canStart: boolean; playersConnected: number };

export type SessionState =
  | JoinState
  | { phase: 'playing'; level: GeneratedLevel }
  | { phase: 'ended'; result: MatchResult };

export interface Multiplayer {
  finish: () => void;
  publishPosition: (position: Point) => void;
  readPeers: () => readonly Point[];
}

export interface Session {
  end: () => void;
  getState: () => SessionState;
  joinLobby: () => void;
  multiplayer: Multiplayer;
  startNow: () => void;
  subscribe: (listener: () => void) => () => void;
}

export function createSession(url: string): Session {
  let state: SessionState = { phase: 'connecting' };
  let seat: PlayerSeat | null = null;
  let peerPositions: Point[] = [];
  const listeners = new Set<() => void>();

  function setState(next: SessionState): void {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'lobby-update':
        setState({
          phase: 'lobby',
          canStart: message.canStart,
          playersConnected: message.playersConnected,
        });
        return;
      case 'match-started':
        seat = message.seat;
        peerPositions = [];
        setState({ phase: 'playing', level: message.level });
        return;
      case 'state-update':
        peerPositions = message.players.flatMap((player) =>
          player.seat === seat ? [] : [player.position],
        );
        return;
      case 'match-ended': {
        if (seat === null) {
          console.warn('[session] match ended before a seat was assigned');
          return;
        }

        const result = { outcome: message.outcome, seat };
        seat = null;
        peerPositions = [];
        setState({ phase: 'ended', result });
        return;
      }
      case 'error':
        console.warn('[session] server error', message.code, message.message);
        return;
    }
  }

  let socket: GameSocketHandle;
  socket = createGameSocket(url, {
    onOpen: () => setState({ phase: 'idle' }),
    onClose: () => {
      seat = null;
      peerPositions = [];
      setState({ phase: 'disconnected' });
    },
    onMessage: handleMessage,
  });

  return {
    end: () => socket.close(),
    getState: () => state,
    joinLobby: () => socket.send({ type: 'join-lobby' }),
    multiplayer: {
      finish: () => socket.send({ type: 'player-finished' }),
      publishPosition: (position) => socket.send({ type: 'ball-update', position }),
      readPeers: () => peerPositions,
    },
    startNow: () => socket.send({ type: 'start-now' }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
