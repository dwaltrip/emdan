import { useSyncExternalStore } from 'react';

import type { PlayerSeat } from '@shared/protocol';
import type { Session } from '@/session/session';

function useCurrentUser(session: Session): { seat: PlayerSeat | null } {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.store.state.game.currentUser,
  );
}

export { useCurrentUser };
