import type { BlobWarsBoardStoreInstance } from './board-store';
import type {
  BlobWarsInputState,
  Coord,
  PlacementInput,
  PlayerId,
} from './types';

function createActions(store: BlobWarsBoardStoreInstance) {
  return {
    addPlayer: store.makeAction((state: BlobWarsInputState, id: PlayerId) => {
      const index = state.game.players.length;
      state.game.players.push({ id, index, lastPlacementTick: -1 });
    }),

    setHoveredCoord: store.makeAction(
      (state: BlobWarsInputState, coord: Coord | null) => {
        state.ui.hoveredCoord = coord;
      },
    ),

    setActiveInputPlayer: store.makeAction(
      (state: BlobWarsInputState, playerId: PlayerId | null) => {
        state.ui.activeInputPlayerId = playerId;
      },
    ),

    setPlacement: store.makeAction(
      (state: BlobWarsInputState, playerId: PlayerId, input: PlacementInput) => {
        state.game.pendingPlacements[playerId] = input;
      },
    ),

    clearPlacement: store.makeAction(
      (state: BlobWarsInputState, playerId: PlayerId) => {
        delete state.game.pendingPlacements[playerId];
      },
    ),

    commitTurn: store.makeAction((state: BlobWarsInputState) => {
      const currentTick = state.game.tick;

      for (const player of state.game.players) {
        const input = state.game.pendingPlacements[player.id];
        if (!input || input.type === 'skip') continue;

        const { coord } = input;
        const tile = state.game.tiles[coord.y][coord.x];
        if (tile.ownerPlayerId !== null) continue;

        tile.ownerPlayerId = player.id;
        tile.type = 'seed';
        player.lastPlacementTick = currentTick;
      }

      // TODO: Resolve growth — for each blob, compute growth direction and
      // apply (+1 expand into adjacent empty/weaker, 0 nothing, -1 lose
      // border tile to stronger).

      state.game.pendingPlacements = {};
      state.game.tick = currentTick + 1;
    }),
  };
}

type BlobWarsActions = ReturnType<typeof createActions>;

export type { BlobWarsActions };
export { createActions };
