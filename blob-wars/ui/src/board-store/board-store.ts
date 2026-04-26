// Per-tile cache over a generic createStore.
//
// Skeleton (keep on extraction): tileCache Map, runPipeline shape,
// createStore wiring, getTileData, reset.
// Filling (game-specific): defaults, derived shape, computeTileData, tilesEqual.
//
// Assumptions:
// - tiles addressable by Coord with stable serialization
// - state changes via discrete actions, not continuous animation
// - per-tile rendering is independent (no cross-tile sprite stitching)
// - grid size fixed for the lifetime of a session
//
// Subscription model: consumers use store.subscribe + store.getTileData.
// A dedicated per-tile sub (subscribeTile) was deleted with the canvas swap;
// reintroduce only if many React components subscribe per-tile (unlikely with
// the canvas renderer drawing the whole board on dirty).

import { createStore } from '@/lib/create-store';
import { perfLog } from '@/lib/perf-log';
import type { PlayerState } from '@shared/protocol';

import { serializeCoord } from './coord';
import { deriveState } from './derived';
import { tilesEqual } from './tile-data';
import { computeTileData } from './tile-derived-state';
import type {
  InputState,
  SourceState,
  State,
  ConnectionStatus,
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

function createDefaultGameState(width: number, height: number): SourceState {
  return {
    matchId: null,
    width,
    height,
    tiles: createEmptyTiles(width, height),
    tick: 0,
    phase: 'placing',
    currentTurn: 'player1',
    players: {
      player1: createDefaultPlayerState(),
      player2: createDefaultPlayerState(),
    },
    currentUser: { seat: null },
  };
}

function createDefaultUIState(): UIState {
  return {};
}

// Default to 'connecting' because session-instance opens the socket at import
// time, before any onOpen/onClose callback can update the status.
const DEFAULT_CONNECTION_STATUS: ConnectionStatus = 'connecting';

function createDefaultInputState(width: number, height: number): InputState {
  return {
    game: createDefaultGameState(width, height),
    ui: createDefaultUIState(),
    connectionStatus: DEFAULT_CONNECTION_STATUS,
  };
}

function createDefaultTileData(coord: Coord): TileData {
  return {
    coord,
    terrain: 'blank',
    owner: null,
    origin: null,
    isPlaceable: true,
    insideExclusion: false,
    exclusionSource: null,
  };
}

function createBoardStore(width: number, height: number) {
  const tileCache = new Map<CoordKey, TileData>();

  // Seam: iteration is the main shape coupling between this store and the grid.
  // To extract, promote to a config param.
  function iterateCoords(state: State, cb: (coord: Coord) => void): void {
    for (let y = 0; y < state.game.height; y++) {
      for (let x = 0; x < state.game.width; x++) {
        cb({ x, y });
      }
    }
  }

  function runPipeline(state: State): { changed: number; total: number; newlyOccupied: number } {
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
      }
    });
    return { changed, total, newlyOccupied };
  }

  const store = createStore<InputState, DerivedState>({
    initialState: createDefaultInputState(width, height),
    derive: (state) => {
      const tick = state.game.tick;
      perfLog.event('pipeStart', tick);
      return perfLog.timed('derive', tick, () => deriveState(state));
    },
    onChange: (merged) => {
      const tick = merged.game.tick;
      const stats = perfLog.timed('diff', tick, () => runPipeline(merged));
      perfLog.event('pipeEnd', tick, stats);
      // `paint` is emitted by the canvas renderer at end of frame().
    },
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

    getTileData(coord: Coord): TileData {
      return tileCache.get(serializeCoord(coord)) ?? createDefaultTileData(coord);
    },

    // Only the `game` substate is reset. connectionStatus and UI state are
    // session-level and survive match transitions.
    reset(newWidth: number = width, newHeight: number = height): void {
      tileCache.clear();
      store.reset({
        ...store.state,
        game: createDefaultGameState(newWidth, newHeight),
      });
    },
  };
}

type BoardStoreInstance = ReturnType<typeof createBoardStore>;

export type { BoardStoreInstance };
export { createBoardStore, createDefaultTileData };
