// Per-tile cache + per-tile subs over a generic createStore.
//
// Skeleton (keep on extraction): tileCache/tileSubs Maps, runPipeline shape,
// createStore wiring, subscribeTile/getTileData, reset.
// Filling (game-specific): defaults, derived shape, computeTileData, tilesEqual.
//
// Assumptions:
// - tiles addressable by Coord with stable serialization
// - state changes via discrete actions, not continuous animation
// - per-tile rendering is independent (no cross-tile sprite stitching)
// - grid size fixed for the lifetime of a session

import { createStore } from '../../../../shared/game-store/create-store';
import type { PlayerState } from '../../../shared/protocol';

import { serializeCoord } from './coord';
import { deriveBlobWarsState } from './derived';
import { tilesEqual } from './tile-data';
import { computeTileData } from './tile-derived-state';
import type {
  BlobWarsInputState,
  BlobWarsSourceState,
  BlobWarsState,
  Coord,
  CoordKey,
  DerivedState,
  TileData,
  TileSource,
  UIState,
} from './types';

function createEmptyTiles(width: number, height: number): TileSource[][] {
  const tiles: TileSource[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TileSource[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ terrain: 'blank', owner: null, origin: null, plantedTick: null, lastGrowthTick: null });
    }
    tiles.push(row);
  }
  return tiles;
}

function createDefaultPlayerState(): PlayerState {
  return { connected: false, occupiedTiles: 0, seedsRemaining: 0 };
}

function createDefaultGameState(width: number, height: number): BlobWarsSourceState {
  return {
    width,
    height,
    tiles: createEmptyTiles(width, height),
    tick: 0,
    players: {
      player1: createDefaultPlayerState(),
      player2: createDefaultPlayerState(),
    },
  };
}

function createDefaultUIState(): UIState {
  return { hoveredCoord: null };
}

function createDefaultInputState(width: number, height: number): BlobWarsInputState {
  return {
    game: createDefaultGameState(width, height),
    ui: createDefaultUIState(),
  };
}

function createDefaultTileData(coord: Coord): TileData {
  return {
    coord,
    terrain: 'blank',
    owner: null,
    origin: null,
    isPlaceable: true,
    isHovered: false,
  };
}

function createBlobWarsBoardStore(width: number, height: number) {
  const tileCache = new Map<CoordKey, TileData>();
  const tileSubs = new Map<CoordKey, Set<() => void>>();

  // Seam: iteration is the main shape coupling between this store and the grid.
  // To extract, promote to a config param.
  function iterateCoords(state: BlobWarsState, cb: (coord: Coord) => void): void {
    for (let y = 0; y < state.game.height; y++) {
      for (let x = 0; x < state.game.width; x++) {
        cb({ x, y });
      }
    }
  }

  function runPipeline(state: BlobWarsState): void {
    let changed = 0;
    let total = 0;
    let newlyOccupied = 0;
    iterateCoords(state, (coord) => {
      total++;
      const key = serializeCoord(coord);
      const next = computeTileData(state, coord);
      const prev = tileCache.get(key);

      if (!prev || !tilesEqual(prev, next)) {
        changed++;
        if ((!prev || prev.owner === null) && next.owner !== null) {
          newlyOccupied++;
        }
        tileCache.set(key, next);
        const subs = tileSubs.get(key);
        if (subs) for (const cb of subs) cb();
      }
    });
    const paddedChanged = String(changed).padStart(String(total).length, ' ');
    console.log(
      `[board-store] tiles re-rendered: ${paddedChanged}/${total} (tick ${state.game.tick}, newly occupied: ${newlyOccupied})`,
    );
  }

  const store = createStore<BlobWarsInputState, DerivedState>({
    initialState: createDefaultInputState(width, height),
    derive: deriveBlobWarsState,
    onChange: runPipeline,
  });

  return {
    get state() {
      return store.state;
    },
    get derived() {
      return store.derived;
    },
    get version() {
      return store.version;
    },

    makeAction: store.makeAction,
    mutate: store.mutate,
    subscribe: store.subscribe,

    subscribeTile(coord: Coord, cb: () => void): () => void {
      const key = serializeCoord(coord);
      let subs = tileSubs.get(key);
      if (!subs) {
        subs = new Set();
        tileSubs.set(key, subs);
      }
      subs.add(cb);
      return () => {
        subs!.delete(cb);
      };
    },

    getTileData(coord: Coord): TileData {
      return tileCache.get(serializeCoord(coord)) ?? createDefaultTileData(coord);
    },

    // Assumes components have unmounted before reset. If you keep the board
    // mounted across resets, force remount via a React `key` on the container.
    reset(newWidth: number = width, newHeight: number = height): void {
      tileCache.clear();
      tileSubs.clear();
      store.reset(createDefaultInputState(newWidth, newHeight));
    },
  };
}

type BlobWarsBoardStoreInstance = ReturnType<typeof createBlobWarsBoardStore>;

export type { BlobWarsBoardStoreInstance };
export { createBlobWarsBoardStore, createDefaultTileData };
