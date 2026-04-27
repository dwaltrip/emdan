import type { ClientRole, MatchSnapshot } from '@shared/protocol';

import type { BoardStoreInstance } from './board-store';
import type { InputState, ConnectionStatus } from './types';

function createActions(store: BoardStoreInstance) {
  return {
    applySnapshot: store.makeAction(
      (state: InputState, snapshot: MatchSnapshot) => {
        // Rotate `state.game` reference so consumers using it as a memo dep
        // (React Compiler, useMemo, React.memo) invalidate per action.
        state.game = { ...state.game };
        state.game.matchId = snapshot.matchId;
        state.game.width = snapshot.board.width;
        state.game.height = snapshot.board.height;
        state.game.tiles = snapshot.board.tiles;
        state.game.tick = snapshot.tick;
        state.game.phase = snapshot.phase;
        state.game.currentTurn = snapshot.currentTurn;
        state.game.players = snapshot.players;
        state.game.currentUser = snapshot.currentUser;
      },
    ),
    setConnectionStatus: store.makeAction(
      (state: InputState, status: ConnectionStatus) => {
        state.connectionStatus = status;
      },
    ),
    setWaitingFor: store.makeAction(
      (state: InputState, waitingFor: ClientRole | null) => {
        state.waitingFor = waitingFor;
      },
    ),
    setOpponentRole: store.makeAction(
      (state: InputState, opponentRole: ClientRole | null) => {
        state.opponentRole = opponentRole;
      },
    ),
  };
}

type Actions = ReturnType<typeof createActions>;

export type { Actions };
export { createActions };
