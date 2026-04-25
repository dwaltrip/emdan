import type { MatchSnapshot } from '@shared/protocol';

import type { BoardStoreInstance } from './board-store';
import type { InputState, ConnectionStatus } from './types';

function createActions(store: BoardStoreInstance) {
  return {
    applySnapshot: store.makeAction(
      (state: InputState, snapshot: MatchSnapshot) => {
        state.game.matchId = snapshot.matchId;
        state.game.width = snapshot.board.width;
        state.game.height = snapshot.board.height;
        state.game.tiles = snapshot.board.tiles;
        state.game.tick = snapshot.tick;
        state.game.phase = snapshot.phase;
        state.game.currentTurn = snapshot.currentTurn;
        state.game.players = snapshot.players;
        // Preserve reference when seat is unchanged so useCurrentUser bails
        // via Object.is instead of re-rendering App every tick.
        if (state.game.currentUser.seat !== snapshot.currentUser.seat) {
          state.game.currentUser = snapshot.currentUser;
        }
      },
    ),
    setConnectionStatus: store.makeAction(
      (state: InputState, status: ConnectionStatus) => {
        state.connectionStatus = status;
      },
    ),
  };
}

type Actions = ReturnType<typeof createActions>;

export type { Actions };
export { createActions };
