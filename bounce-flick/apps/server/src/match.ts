import type {
  FinishTime,
  MatchOutcome,
  MatchWinner,
  PlayerSeat,
  ServerMessage,
} from '@shared/protocol';
import type { Point } from '@shared/level';

export interface MatchPlayer {
  id: string;
  seat: PlayerSeat;
  send: (message: ServerMessage) => void;
}

interface MatchOptions {
  now?: () => number;
  onEnded: () => void;
  players: MatchPlayer[];
}

type PlayerState = MatchPlayer & {
  elapsedMs: number | null;
  position: Point | null;
};

// A match owns participant state and the one clock shared by every retry of its
// level. Client-side crashes recreate the game runtime, not this Match.
export class Match {
  private ended = false;
  private readonly now: () => number;
  private readonly onEnded: () => void;
  private readonly players: PlayerState[];
  private readonly startedAt: number;

  constructor({ now = () => performance.now(), onEnded, players }: MatchOptions) {
    this.now = now;
    this.onEnded = onEnded;
    this.players = players.map((player) => ({ ...player, elapsedMs: null, position: null }));
    this.startedAt = now();
  }

  hasClient(clientId: string): boolean {
    return this.players.some((player) => player.id === clientId);
  }

  handleBallUpdate(clientId: string, position: Point): void {
    if (this.ended) {
      return;
    }

    const player = this.player(clientId);
    if (!player) {
      return;
    }

    player.position = position;
    this.broadcast({
      type: 'state-update',
      players: this.players.flatMap(({ position: currentPosition, seat }) =>
        currentPosition ? [{ position: currentPosition, seat }] : [],
      ),
    });
  }

  handleFinished(clientId: string): void {
    if (this.ended) {
      return;
    }

    const player = this.player(clientId);
    if (!player || player.elapsedMs !== null) {
      return;
    }

    player.elapsedMs = Math.max(0, this.now() - this.startedAt);
    const times = this.players.flatMap(({ elapsedMs, seat }) =>
      elapsedMs === null ? [] : [{ elapsedMs, seat }],
    );
    if (times.length === this.players.length) {
      this.finish({ type: 'finished', times, winner: decideWinner(times) });
    }
  }

  handleDisconnect(clientId: string): void {
    if (!this.ended && this.hasClient(clientId)) {
      this.finish({ type: 'aborted', reason: 'disconnect' });
    }
  }

  private broadcast(message: ServerMessage): void {
    this.players.forEach((player) => player.send(message));
  }

  private finish(outcome: MatchOutcome): void {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.broadcast({ type: 'match-ended', outcome });
    this.onEnded();
  }

  private player(clientId: string): PlayerState | undefined {
    return this.players.find((player) => player.id === clientId);
  }
}

function decideWinner(times: FinishTime[]): MatchWinner {
  const bestTime = Math.min(...times.map(({ elapsedMs }) => elapsedMs));
  const winners = times.filter(({ elapsedMs }) => elapsedMs === bestTime);

  return winners.length === 1 ? winners[0]!.seat : 'draw';
}
