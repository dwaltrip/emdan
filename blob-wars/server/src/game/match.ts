import {
  GROWTH_EVERY_TICKS,
  GRID_HEIGHT,
  GRID_WIDTH,
  SEED_EXCLUSION_RADIUS,
  STARTING_SEEDS,
  TICK_INTERVAL_MS,
  type ClientMessage,
  type MatchEndReason,
  type MatchPhase,
  type MatchSnapshot,
  type MatchWinner,
  type PlayerSeat,
  type ServerMessage,
} from "@shared/protocol";
import {
  clearTile,
  countTiles,
  createBoard,
  getNeighborCoordinates,
  isBoardFull,
  isInsideBoard,
  otherSeat,
  type Tile,
} from "./board";
import { addClaim, analyzeBlobs, determineClaimWinner, type TileClaim } from "./blob";

interface QueuedAction {
  clientId: string;
  seat: PlayerSeat;
  x: number;
  y: number;
}

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
  private readonly board: Tile[][];
  private readonly startedAt = Date.now();
  private readonly seedsRemaining: Record<PlayerSeat, number>;
  private tickNumber = 0;
  private timer: NodeJS.Timeout | null = null;
  private ended = false;
  private phase: MatchPhase = "placing";
  private currentTurn: PlayerSeat = "player1";

  constructor(options: MatchOptions) {
    this.id = `match-${Date.now()}`;
    this.clientIds = options.clientIds;
    this.send = options.send;
    this.isConnected = options.isConnected;
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

    if (this.phase !== "placing") {
      this.sendError(seat, "wrong_phase", "Seeds can only be placed during the placing phase.");
      return;
    }

    this.applyPlacement({ clientId, seat, x: message.x, y: message.y });
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

  private applyPlacement(action: QueuedAction): void {
    if (action.seat !== this.currentTurn) {
      this.sendError(action.seat, "not_your_turn", "It is not your turn to place a seed.");
      return;
    }

    const tile = this.board[action.y]?.[action.x];
    if (!tile) {
      return;
    }

    if (this.seedsRemaining[action.seat] <= 0) {
      this.sendError(action.seat, "no_seeds", "You are out of seeds.");
      return;
    }

    if (tile.terrain === "wall") {
      this.sendError(action.seat, "tile_impassable", "That tile is impassable.");
      return;
    }

    if (tile.owner !== null) {
      this.sendError(action.seat, "tile_occupied", "That tile is already occupied.");
      return;
    }

    if (violatesExclusion(this.board, action.x, action.y, SEED_EXCLUSION_RADIUS)) {
      this.sendError(
        action.seat,
        "too_close_to_seed",
        `Seeds must be at least ${SEED_EXCLUSION_RADIUS} tiles from every other seed.`,
      );
      return;
    }

    tile.owner = action.seat;
    tile.origin = "seed";
    tile.plantedTick = this.tickNumber;
    tile.lastGrowthTick = this.tickNumber;
    this.seedsRemaining[action.seat] -= 1;
    this.currentTurn = otherSeat(action.seat);

    if (this.seedsRemaining.player1 === 0 && this.seedsRemaining.player2 === 0) {
      this.beginSimulation();
      return;
    }

    this.sendToAll({
      type: "stateUpdate",
      state: this.getSnapshot(),
    });
  }

  private beginSimulation(): void {
    this.phase = "simulating";
    this.sendToAll({
      type: "stateUpdate",
      state: this.getSnapshot(),
    });

    this.timer = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);
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
    this.phase = "ended";

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
      phase: this.phase,
      currentTurn: this.phase === "placing" ? this.currentTurn : null,
      board: {
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
        tiles: this.board.map((row) => row.map((tile) => ({ ...tile }))),
      },
      players: {
        player1: {
          connected: this.isConnected("player1"),
          occupiedTiles: counts.player1,
          seedsRemaining: this.seedsRemaining.player1,
        },
        player2: {
          connected: this.isConnected("player2"),
          occupiedTiles: counts.player2,
          seedsRemaining: this.seedsRemaining.player2,
        },
      },
    };
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

function violatesExclusion(board: Tile[][], x: number, y: number, radius: number): boolean {
  const minY = Math.max(0, y - radius);
  const maxY = Math.min(board.length - 1, y + radius);

  for (let ny = minY; ny <= maxY; ny += 1) {
    const row = board[ny]!;
    const remaining = radius - Math.abs(ny - y);
    const minX = Math.max(0, x - remaining);
    const maxX = Math.min(row.length - 1, x + remaining);

    for (let nx = minX; nx <= maxX; nx += 1) {
      if (row[nx]!.origin === "seed") {
        return true;
      }
    }
  }

  return false;
}

function determineWinner(snapshot: MatchSnapshot): MatchWinner {
  const player1Count = snapshot.players.player1.occupiedTiles;
  const player2Count = snapshot.players.player2.occupiedTiles;

  if (player1Count === player2Count) {
    return "draw";
  }

  return player1Count > player2Count ? "player1" : "player2";
}
