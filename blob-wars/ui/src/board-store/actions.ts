import type { MatchSnapshot } from '@shared/protocol';

import type { BlobWarsBoardStoreInstance } from './board-store';
import type { BlobWarsInputState, Coord } from './types';

function createActions(store: BlobWarsBoardStoreInstance) {
  return {
    applySnapshot: store.makeAction(
      (state: BlobWarsInputState, snapshot: MatchSnapshot) => {
        state.game.width = snapshot.board.width;
        state.game.height = snapshot.board.height;
        state.game.tiles = snapshot.board.tiles;
        state.game.tick = snapshot.tick;
        state.game.players = snapshot.players;
      },
    ),

    setHoveredCoord: store.makeAction(
      (state: BlobWarsInputState, coord: Coord | null) => {
        state.ui.hoveredCoord = coord;
      },
    ),
  };
}

type BlobWarsActions = ReturnType<typeof createActions>;

export type { BlobWarsActions };
export { createActions };
