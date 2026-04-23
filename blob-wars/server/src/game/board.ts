import {
  GRID_HEIGHT,
  GRID_WIDTH,
  type PlayerSeat,
  type TileTerrain,
} from "@shared/protocol";
import { generateTerrain } from "./terrain";

export interface Tile {
  terrain: TileTerrain;
  owner: PlayerSeat | null;
  origin: "seed" | "spread" | null;
  plantedTick: number | null;
  lastGrowthTick: number | null;
}

export function createBoard(): Tile[][] {
  const terrain = generateTerrain(GRID_WIDTH, GRID_HEIGHT);
  return terrain.map((row) =>
    row.map((cell) => ({
      terrain: cell,
      owner: null,
      origin: null,
      plantedTick: null,
      lastGrowthTick: null,
    })),
  );
}

export function countTiles(board: Tile[][]): Record<PlayerSeat, number> {
  const counts: Record<PlayerSeat, number> = {
    player1: 0,
    player2: 0,
  };

  for (const row of board) {
    for (const tile of row) {
      if (tile.owner) {
        counts[tile.owner] += 1;
      }
    }
  }

  return counts;
}

export function isBoardFull(board: Tile[][]): boolean {
  return board.every((row) => row.every((tile) => tile.terrain === "wall" || tile.owner !== null));
}

export function clearTile(tile: Tile): void {
  tile.owner = null;
  tile.origin = null;
  tile.plantedTick = null;
  tile.lastGrowthTick = null;
}

export function isInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}

export function getNeighborCoordinates(x: number, y: number): Array<[number, number]> {
  const neighbors: Array<[number, number]> = [
    [x, y - 1],
    [x + 1, y],
    [x, y + 1],
    [x - 1, y],
  ];

  return neighbors.filter(([nextX, nextY]) => isInsideBoard(nextX, nextY));
}

export function otherSeat(seat: PlayerSeat): PlayerSeat {
  return seat === "player1" ? "player2" : "player1";
}
