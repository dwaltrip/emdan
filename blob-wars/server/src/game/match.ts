import {
  GROWTH_EVERY_TICKS,
  GRID_HEIGHT,
  GRID_WIDTH,
  STARTING_SEEDS,
  TICK_INTERVAL_MS,
  type ClientMessage,
  type MatchEndReason,
  type MatchSnapshot,
  type MatchWinner,
  type PlayerSeat,
  type ServerMessage,
} from "../../../shared/protocol.ts";
import {
  clearTile,
  countTiles,
  createBoard,
  getNeighborCoordinates,
  isBoardFull,
  isInsideBoard,
  otherSeat,
  type Tile,
} from "./board.ts";
import { addClaim, analyzeBlobs, determineClaimWinner, type TileClaim } from "./blob.ts";
import type { MatchTransport } from "./transport.ts";

interface QueuedAction {
  clientId: string;
  seat: PlayerSeat;
  x: number;
  y: number;
}

interface MatchOptions {
  clientIds: Record<PlayerSeat, string>;
  transport: MatchTransport;
  onEnded: () => void;
}

export class Match {
  readonly id: string;

  private readonly clientIds: Record<PlayerSeat, string>;
  private readonly transport: MatchTransport;
  private readonly onEnded: MatchOptions["onEnded"];
  private readonly board: Tile[][];
  private readonly startedAt = Date.now();
  private readonly queuedActions: QueuedAction[] = [];
  private readonly seedsRemaining: Record<PlayerSeat, number>;
  private tickNumber = 0;
  private timer: NodeJS.Timeout | null = null;
  private ended = false;

  constructor(options: MatchOptions) {
    this.id = `match-${Date.now()}`;
    this.clientIds = options.clientIds;
    this.transport = options.transport;
    this.onEnded = options.onEnded;
    this.board = createBoard();
    this.seedsRemaining = {
      player1: STARTING_SEEDS,
      player2: STARTING_SEEDS,
    };
  }

  start(): void {
    const snapshot = this.getSnapshot();

    this.sendToAll((seat) => ({
      type: "matchStarted",
      seat,
      state: snapshot,
    }));

    this.timer = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);
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

    if (!Number.isInteger(message.x) || !Number.isInteger(message.y)) {
      this.sendError(seat, "invalid_coordinates", "Seed coordinates must be integers.");
      return;
    }

    if (!isInsideBoard(message.x, message.y)) {
      this.sendError(seat, "out_of_bounds", "Seed coordinates are outside the board.");
      return;
    }

    this.queuedActions.push({
      clientId,
      seat,
      x: message.x,
      y: message.y,
    });
  }

  handleDisconnect(clientId: string): void {
    if (this.ended) {
      return;
    }

    const seat = this.getSeatByClientId(clientId);
    if (!seat) {
      return;
    }

    const winner = otherSeat(seat);
    this.finish("disconnect", winner);
  }

  private tick(): void {
    if (this.ended) {
      return;
    }

    this.tickNumber += 1;
    this.applyQueuedActions();

    if (this.tickNumber % GROWTH_EVERY_TICKS === 0) {
      this.expandSeeds();
    }

    const snapshot = this.getSnapshot();
    this.sendToAll({
      type: "stateUpdate",
      state: snapshot,
    });

    if (isBoardFull(this.board)) {
      this.finish("boardFull", determineWinner(snapshot));
    }
  }

  private applyQueuedActions(): void {
    for (const action of this.queuedActions.splice(0)) {
      const seat = this.getSeatByClientId(action.clientId);
      if (!seat || seat !== action.seat) {
        continue;
      }

      const tile = this.board[action.y]?.[action.x];
      if (!tile) {
        continue;
      }

      if (this.seedsRemaining[action.seat] <= 0) {
        this.sendError(action.seat, "no_seeds", "You are out of seeds.");
        continue;
      }

      if (tile.terrain === "wall") {
        this.sendError(action.seat, "tile_impassable", "That tile is impassable.");
        continue;
      }

      if (tile.owner !== null) {
        this.sendError(action.seat, "tile_occupied", "That tile is already occupied.");
        continue;
      }

      tile.owner = action.seat;
      tile.origin = "seed";
      tile.plantedTick = this.tickNumber;
      tile.lastGrowthTick = this.tickNumber;
      this.seedsRemaining[action.seat] -= 1;
    }
  }

  private expandSeeds(): void {
    const blobAnalysis = analyzeBlobs(this.board);
    const claims = new Map<string, TileClaim>();

    for (let y = 0; y < this.board.length; y += 1) {
      for (let x = 0; x < this.board[y]!.length; x += 1) {
        const tile = this.board[y]![x]!;
        const componentId = blobAnalysis.componentIds[y]?.[x] ?? null;

        if (tile.owner === null || tile.lastGrowthTick === null || componentId === null) {
          continue;
        }

        const componentPower = blobAnalysis.componentPower.get(componentId) ?? 0;
        if (componentPower <= 0) {
          continue;
        }

        if (this.tickNumber - tile.lastGrowthTick < GROWTH_EVERY_TICKS) {
          continue;
        }

        tile.lastGrowthTick = this.tickNumber;

        for (const [nextX, nextY] of getNeighborCoordinates(x, y)) {
          const target = this.board[nextY]?.[nextX];
          if (!target || target.terrain === "wall") {
            continue;
          }

          const key = `${nextX},${nextY}`;
          addClaim(claims, key, tile.owner, componentId);
        }
      }
    }

    for (const [key, claim] of claims) {
      const [xText, yText] = key.split(",");
      const x = Number.parseInt(xText ?? "", 10);
      const y = Number.parseInt(yText ?? "", 10);
      const tile = this.board[y]?.[x];
      if (Number.isNaN(x) || Number.isNaN(y) || !tile) {
        continue;
      }

      const defendingComponentId =
        tile.owner === null ? null : (blobAnalysis.componentIds[y]?.[x] ?? null);
      if (tile.owner !== null && defendingComponentId !== null) {
        addClaim(claims, key, tile.owner, defendingComponentId);
      }

      const winningSeat = determineClaimWinner(claim, blobAnalysis.componentPower);
      if (winningSeat === null) {
        clearTile(tile);
        continue;
      }

      if (tile.owner === winningSeat) {
        continue;
      }

      tile.owner = winningSeat;
      tile.origin = "spread";
      tile.plantedTick = this.tickNumber;
      tile.lastGrowthTick = this.tickNumber;
    }
  }

  private finish(reason: MatchEndReason, winner: MatchWinner): void {
    if (this.ended) {
      return;
    }

    this.ended = true;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const snapshot = this.getSnapshot();
    this.sendToAll({
      type: "matchEnded",
      reason,
      winner,
      state: snapshot,
    });

    this.onEnded();
  }

  private getSnapshot(): MatchSnapshot {
    const counts = countTiles(this.board);

    return {
      matchId: this.id,
      tick: this.tickNumber,
      serverTimeMs: Date.now() - this.startedAt,
      tickIntervalMs: TICK_INTERVAL_MS,
      growthEveryTicks: GROWTH_EVERY_TICKS,
      board: {
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
        tiles: this.board.map((row) => row.map((tile) => ({ ...tile }))),
      },
      players: {
        player1: {
          connected: this.transport.isConnected("player1"),
          occupiedTiles: counts.player1,
          seedsRemaining: this.seedsRemaining.player1,
        },
        player2: {
          connected: this.transport.isConnected("player2"),
          occupiedTiles: counts.player2,
          seedsRemaining: this.seedsRemaining.player2,
        },
      },
    };
  }

  private sendToAll(message: ServerMessage | ((seat: PlayerSeat) => ServerMessage)): void {
    this.transport.send("player1", typeof message === "function" ? message("player1") : message);
    this.transport.send("player2", typeof message === "function" ? message("player2") : message);
  }

  private sendError(seat: PlayerSeat, code: string, message: string): void {
    this.transport.send(seat, {
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

function determineWinner(snapshot: MatchSnapshot): MatchWinner {
  const player1Count = snapshot.players.player1.occupiedTiles;
  const player2Count = snapshot.players.player2.occupiedTiles;

  if (player1Count === player2Count) {
    return "draw";
  }

  return player1Count > player2Count ? "player1" : "player2";
}
