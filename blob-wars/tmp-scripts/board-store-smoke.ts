// Smoke test for the board-store.
// Run from blob-wars/: `pnpm dlx tsx tmp-scripts/board-store-smoke.ts`
//
// Imports target files directly (not the ./board-store barrel) so we
// don't pull in hooks.ts, which wants React from ui/node_modules.

import assert from "node:assert/strict";

import type { MatchSnapshot, TileState } from "../shared/protocol";
import { createActions } from "../ui/src/board-store/actions";
import { createBlobWarsBoardStore } from "../ui/src/board-store/board-store";

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
  };
}

function run(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS  ${label}`);
  } catch (err) {
    console.error(`FAIL  ${label}`);
    console.error(err);
    process.exitCode = 1;
  }
}

run("per-tile diff fires only on changed tiles", () => {
  const store = createBlobWarsBoardStore(3, 3);
  const actions = createActions(store);

  const fires = new Map<string, number>();
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const key = `${x},${y}`;
      fires.set(key, 0);
      store.subscribeTile({ x, y }, () => {
        fires.set(key, (fires.get(key) ?? 0) + 1);
      });
    }
  }

  const tiles: TileState[][] = [
    [seedTile("player1"), emptyTile(), emptyTile()],
    [emptyTile(), emptyTile(), emptyTile()],
    [emptyTile(), emptyTile(), emptyTile()],
  ];
  actions.applySnapshot(snapshotOf(tiles));

  assert.equal(fires.get("0,0"), 1, "changed tile should fire once");
  for (const [key, count] of fires) {
    if (key === "0,0") continue;
    assert.equal(count, 0, `unchanged tile ${key} should not fire (got ${count})`);
  }
});

run("applySnapshot is idempotent (no fires on identical re-apply)", () => {
  const store = createBlobWarsBoardStore(3, 3);
  const actions = createActions(store);

  const tiles: TileState[][] = [
    [seedTile("player1"), emptyTile(), emptyTile()],
    [emptyTile(), emptyTile(), emptyTile()],
    [emptyTile(), emptyTile(), emptyTile()],
  ];
  const snapshot = snapshotOf(tiles);
  actions.applySnapshot(snapshot);

  let fires = 0;
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      store.subscribeTile({ x, y }, () => {
        fires++;
      });
    }
  }

  actions.applySnapshot(snapshot);
  assert.equal(fires, 0, `expected 0 fires on re-apply, got ${fires}`);
});

run("tile owner/origin reflect the snapshot", () => {
  const store = createBlobWarsBoardStore(2, 2);
  const actions = createActions(store);

  actions.applySnapshot(
    snapshotOf([
      [seedTile("player1"), emptyTile()],
      [emptyTile(), seedTile("player2")],
    ]),
  );

  assert.equal(store.getTileData({ x: 0, y: 0 }).owner, "player1");
  assert.equal(store.getTileData({ x: 0, y: 0 }).origin, "seed");
  assert.equal(store.getTileData({ x: 1, y: 1 }).owner, "player2");
  assert.equal(store.getTileData({ x: 1, y: 1 }).isPlaceable, false);
  assert.equal(store.getTileData({ x: 1, y: 0 }).isPlaceable, true);
});

console.log("\nsmoke complete");
