import type { GeneratedLevel, Point } from './level';

export type { GeneratedLevel } from './level';

export type PlayerSeat = number;
export type MatchWinner = PlayerSeat | 'draw';

export type PlayerPosition = {
  position: Point;
  seat: PlayerSeat;
};

export type FinishTime = {
  elapsedMs: number;
  seat: PlayerSeat;
};

export type MatchOutcome =
  | { type: 'finished'; times: FinishTime[]; winner: MatchWinner }
  | { type: 'aborted'; reason: 'disconnect' };

// Browser -> server. The server validates these commands at the socket boundary.
export type ClientMessage =
  | { type: 'join-lobby' }
  | { type: 'start-now' }
  | { type: 'ball-update'; position: Point }
  | { type: 'player-finished' };

export type ServerErrorCode =
  | 'invalid-message'
  | 'lobby-full'
  | 'match-in-progress'
  | 'not-in-lobby';

// Server -> browser. Match setup is atomic: a client cannot be "started"
// without also knowing its seat and level.
export type ServerMessage =
  | { type: 'lobby-update'; canStart: boolean; playersConnected: number }
  | { type: 'match-started'; level: GeneratedLevel; seat: PlayerSeat }
  | { type: 'state-update'; players: PlayerPosition[] }
  | { type: 'match-ended'; outcome: MatchOutcome }
  | { type: 'error'; code: ServerErrorCode; message: string };
