import { it, expect } from "vitest";

import type { MatchSnapshot, TileState } from "@shared/protocol";

import { createActions } from "./actions";
import { createBoardStore } from "./board-store";

function emptyTile(): TileState {
  return { terrain: "blank", owner: null, origin: null, plantedTick: null, lastGrowthTick: null };
}

function seedTile(owner: "player1" | "player2", tick = 0): TileState {
  return { terrain: "blank", owner, origin: "seed", plantedTick: tick, lastGrowthTick: null };
}

function snapshotOf(tiles: TileState[][], tick = 0): MatchSnapshot {
  return {
    matchId: "smoke",
    tick,
    serverTimeMs: 0,
    tickIntervalMs: 1000,
    growthEveryTicks: 10,
    phase: "simulating",
    currentTurn: null,
    board: { width: tiles[0].length, height: tiles.length, tiles },
    players: {
      player1: { connected: true, occupiedTiles: 0, seedsRemaining: 0 },
      player2: { connected: true, occupiedTiles: 0, seedsRemaining: 0 },
    },
    currentUser: { seat: null },
  };
}

it("applySnapshot is idempotent (no per-tile diff on identical re-apply)", () => {
  const store = createBoardStore(3, 3);
  const actions = createActions(store);

  const tiles: TileState[][] = [
    [seedTile("player1"), emptyTile(), emptyTile()],
    [emptyTile(), emptyTile(), emptyTile()],
    [emptyTile(), emptyTile(), emptyTile()],
  ];
  const snapshot = snapshotOf(tiles);
  actions.applySnapshot(snapshot);

  // The per-tile cache only set()s entries that differ from prev, so
  // === across re-apply means zero tiles diffed.
  const before = new Map<string, unknown>();
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      before.set(`${x},${y}`, store.getTileData({ x, y }));
    }
  }

  actions.applySnapshot(snapshot);

  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const key = `${x},${y}`;
      expect(store.getTileData({ x, y }), `tile ${key} ref changed on idempotent re-apply`).toBe(before.get(key));
    }
  }
});

it("tile owner/origin reflect the snapshot", () => {
  const store = createBoardStore(2, 2);
  const actions = createActions(store);

  actions.applySnapshot(
    snapshotOf([
      [seedTile("player1"), emptyTile()],
      [emptyTile(), seedTile("player2")],
    ]),
  );

  expect(store.getTileData({ x: 0, y: 0 }).owner).toBe("player1");
  expect(store.getTileData({ x: 0, y: 0 }).origin).toBe("seed");
  expect(store.getTileData({ x: 1, y: 1 }).owner).toBe("player2");
  expect(store.getTileData({ x: 1, y: 1 }).isPlaceable).toBe(false);
  expect(store.getTileData({ x: 1, y: 0 }).isPlaceable).toBe(true);
});
