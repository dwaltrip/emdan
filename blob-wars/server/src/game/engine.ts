import {
  GROWTH_EVERY_TICKS,
  GRID_HEIGHT,
  GRID_WIDTH,
  SEED_EXCLUSION_RADIUS,
  STARTING_SEEDS,
  type BoardState,
  type MatchPhase,
  type MatchWinner,
  type PlayerSeat,
} from "@shared/protocol";
import {
  clearTile,
  countTiles,
  createBoard,
  getAllEightNeighbors,
  getNeighborCoordinates,
  isBoardFull,
  isInsideBoard,
  otherSeat,
  type Tile,
} from "./board";
import { circularNeighborhood } from "@shared/geometry";
import { addClaim, analyzeBlobs, determineClaimWinner, type TileClaim } from "./blob";

export type PlaceErrorCode =
  | "wrong_phase"
  | "not_your_turn"
  | "out_of_bounds"
  | "no_seeds"
  | "tile_impassable"
  | "tile_occupied"
  | "too_close_to_seed";

export type PlaceResult =
  | { ok: true; phaseChanged?: MatchPhase }
  | { ok: false; code: PlaceErrorCode; message: string };

export type StepResult = { phaseChanged?: MatchPhase };

export interface GameStateSnapshot {
  tick: number;
  phase: MatchPhase;
  currentTurn: PlayerSeat | null;
  board: BoardState;
  seats: Record<PlayerSeat, { occupiedTiles: number; seedsRemaining: number }>;
}

export interface GameEngineOptions {
  board?: Tile[][];
}

export class GameEngine {
  private readonly board: Tile[][];
  private readonly seedsRemaining: Record<PlayerSeat, number>;
  private tickNumber = 0;
  private phaseState: MatchPhase = "placing";
  private currentTurn: PlayerSeat = "player1";

  constructor(opts: GameEngineOptions = {}) {
    this.board = opts.board ?? createBoard();
    this.seedsRemaining = {
      player1: STARTING_SEEDS,
      player2: STARTING_SEEDS,
    };
  }

  get phase(): MatchPhase {
    return this.phaseState;
  }

  placeSeed(seat: PlayerSeat, x: number, y: number): PlaceResult {
    if (this.phaseState !== "placing") {
      return { ok: false, code: "wrong_phase", message: "Seeds can only be placed during the placing phase." };
    }

    if (seat !== this.currentTurn) {
      return { ok: false, code: "not_your_turn", message: "It is not your turn to place a seed." };
    }

    if (!isInsideBoard(x, y)) {
      return { ok: false, code: "out_of_bounds", message: "Seed coordinates are outside the board." };
    }

    if (this.seedsRemaining[seat] <= 0) {
      return { ok: false, code: "no_seeds", message: "You are out of seeds." };
    }

    const tile = this.board[y]![x]!;

    if (tile.terrain === "wall") {
      return { ok: false, code: "tile_impassable", message: "That tile is impassable." };
    }

    if (tile.owner !== null) {
      return { ok: false, code: "tile_occupied", message: "That tile is already occupied." };
    }

    if (violatesExclusion(this.board, x, y, SEED_EXCLUSION_RADIUS)) {
      return {
        ok: false,
        code: "too_close_to_seed",
        message: `Seeds must be at least ${SEED_EXCLUSION_RADIUS} tiles from every other seed.`,
      };
    }

    tile.owner = seat;
    tile.origin = "seed";
    tile.plantedTick = this.tickNumber;
    tile.lastGrowthTick = this.tickNumber;
    this.seedsRemaining[seat] -= 1;
    this.currentTurn = otherSeat(seat);

    if (this.seedsRemaining.player1 === 0 && this.seedsRemaining.player2 === 0) {
      this.phaseState = "simulating";
      return { ok: true, phaseChanged: "simulating" };
    }

    return { ok: true };
  }

  step(): StepResult {
    if (this.phaseState !== "simulating") {
      return {};
    }

    this.tickNumber += 1;

    if (this.tickNumber % GROWTH_EVERY_TICKS === 0) {
      this.expandSeeds();
    }

    if (isBoardFull(this.board)) {
      this.phaseState = "ended";
      return { phaseChanged: "ended" };
    }

    return {};
  }

  end(): void {
    this.phaseState = "ended";
  }

  toSnapshot(): GameStateSnapshot {
    const counts = countTiles(this.board);

    return {
      tick: this.tickNumber,
      phase: this.phaseState,
      currentTurn: this.phaseState === "placing" ? this.currentTurn : null,
      board: {
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
        tiles: this.board.map((row) => row.map((tile) => ({ ...tile }))),
      },
      seats: {
        player1: { occupiedTiles: counts.player1, seedsRemaining: this.seedsRemaining.player1 },
        player2: { occupiedTiles: counts.player2, seedsRemaining: this.seedsRemaining.player2 },
      },
    };
  }

  determineWinner(): MatchWinner {
    const counts = countTiles(this.board);

    if (counts.player1 === counts.player2) {
      return "draw";
    }

    return counts.player1 > counts.player2 ? "player1" : "player2";
  }

  private expandSeeds(): void {
    const blobAnalysis = analyzeBlobs(this.board);
    const claims = new Map<string, TileClaim>();

    // Diagonals fire 2 of every 3 growth steps → rate ≈ 0.67, close to 1/√2 (Euclidean).
    const growthStep = Math.floor(this.tickNumber / GROWTH_EVERY_TICKS);
    // const includeDiagonals = growthStep % 3 !== 0;
    // const includeDiagonals = growthStep % 7 < 5;
    const includeDiagonals = growthStep % 2 !== 0;
    const neighborsOf = includeDiagonals ? getAllEightNeighbors : getNeighborCoordinates;

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

        for (const [nextX, nextY] of neighborsOf(x, y)) {
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
}

function violatesExclusion(board: Tile[][], x: number, y: number, radius: number): boolean {
  const bounds = { width: board[0]!.length, height: board.length };
  for (const [nx, ny] of circularNeighborhood(x, y, radius, bounds)) {
    if (board[ny]![nx]!.origin === "seed") return true;
  }
  return false;
}
