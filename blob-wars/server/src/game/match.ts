import {
  GROWTH_EVERY_TICKS,
  TICK_INTERVAL_MS,
  type ClientMessage,
  type MatchEndReason,
  type MatchSnapshot,
  type MatchWinner,
  type PlayerSeat,
  type ServerMessage,
} from "@shared/protocol";
import { otherSeat } from "./board";
import { GameEngine } from "./engine";

interface MatchOptions {
  clientIds: Record<PlayerSeat, string>;
  send: (seat: PlayerSeat, message: ServerMessage) => void;
  isConnected: (seat: PlayerSeat) => boolean;
  onEnded: () => void;
}

export class Match {
  readonly id: string;

  private readonly clientIds: Record<PlayerSeat, string>;
  private readonly send: MatchOptions["send"];
  private readonly isConnected: MatchOptions["isConnected"];
  private readonly onEnded: MatchOptions["onEnded"];
  private readonly engine = new GameEngine();
  private readonly startedAt = Date.now();
  private timer: NodeJS.Timeout | null = null;
  private ended = false;

  constructor(options: MatchOptions) {
    this.id = `match-${Date.now()}`;
    this.clientIds = options.clientIds;
    this.send = options.send;
    this.isConnected = options.isConnected;
    this.onEnded = options.onEnded;
  }

  start(): void {
    this.sendToAll((seat) => ({
      type: "matchStarted",
      seat,
      state: this.toSnapshot(),
    }));
  }

  hasClient(clientId: string): boolean {
    return this.clientIds.player1 === clientId || this.clientIds.player2 === clientId;
  }

  handleClientMessage(clientId: string, message: Exclude<ClientMessage, { type: "joinLobby" }>): void {
    if (this.ended) {
      return;
    }

    const seat = this.getSeatByClientId(clientId);
    if (!seat) {
      return;
    }

    if (message.type === "ping") {
      return;
    }

    const result = this.engine.placeSeed(seat, message.x, message.y);
    if (!result.ok) {
      this.sendError(seat, result.code, result.message);
      return;
    }

    this.broadcastState();

    if (result.phaseChanged === "simulating") {
      this.startSimulationTimer();
    }
  }

  handleDisconnect(clientId: string): void {
    if (this.ended) {
      return;
    }

    const seat = this.getSeatByClientId(clientId);
    if (!seat) {
      return;
    }

    this.finish("disconnect", otherSeat(seat));
  }

  private tick(): void {
    if (this.ended) {
      return;
    }

    const result = this.engine.step();
    this.broadcastState();

    if (result.phaseChanged === "ended") {
      this.finish("boardFull", this.engine.determineWinner());
    }
  }

  private startSimulationTimer(): void {
    this.timer = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);
  }

  private finish(reason: MatchEndReason, winner: MatchWinner): void {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.engine.end();

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.sendToAll({
      type: "matchEnded",
      reason,
      winner,
      state: this.toSnapshot(),
    });

    this.onEnded();
  }

  private toSnapshot(): MatchSnapshot {
    const gs = this.engine.toSnapshot();

    return {
      matchId: this.id,
      tick: gs.tick,
      serverTimeMs: Date.now() - this.startedAt,
      tickIntervalMs: TICK_INTERVAL_MS,
      growthEveryTicks: GROWTH_EVERY_TICKS,
      phase: gs.phase,
      currentTurn: gs.currentTurn,
      board: gs.board,
      players: {
        player1: { connected: this.isConnected("player1"), ...gs.seats.player1 },
        player2: { connected: this.isConnected("player2"), ...gs.seats.player2 },
      },
    };
  }

  private broadcastState(): void {
    this.sendToAll({
      type: "stateUpdate",
      state: this.toSnapshot(),
    });
  }

  private sendToAll(message: ServerMessage | ((seat: PlayerSeat) => ServerMessage)): void {
    this.send("player1", typeof message === "function" ? message("player1") : message);
    this.send("player2", typeof message === "function" ? message("player2") : message);
  }

  private sendError(seat: PlayerSeat, code: string, message: string): void {
    this.send(seat, {
      type: "error",
      code,
      message,
    });
  }

  private getSeatByClientId(clientId: string): PlayerSeat | null {
    if (this.clientIds.player1 === clientId) {
      return "player1";
    }

    if (this.clientIds.player2 === clientId) {
      return "player2";
    }

    return null;
  }
}
