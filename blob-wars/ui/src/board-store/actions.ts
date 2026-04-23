import type { MatchSnapshot } from '@shared/protocol';

import type { BlobWarsBoardStoreInstance } from './board-store';
import type { BlobWarsInputState } from './types';

function createActions(store: BlobWarsBoardStoreInstance) {
  return {
    applySnapshot: store.makeAction(
      (state: BlobWarsInputState, snapshot: MatchSnapshot) => {
        state.game.width = snapshot.board.width;
        state.game.height = snapshot.board.height;
        state.game.tiles = snapshot.board.tiles;
        state.game.tick = snapshot.tick;
        state.game.phase = snapshot.phase;
        state.game.currentTurn = snapshot.currentTurn;
        state.game.players = snapshot.players;
      },
    ),
  };
}

type BlobWarsActions = ReturnType<typeof createActions>;

export type { BlobWarsActions };
export { createActions };
