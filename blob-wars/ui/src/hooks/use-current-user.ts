import { useSyncExternalStore } from 'react';

import type { PlayerSeat } from '@shared/protocol';
import type { BlobWarsSession } from '@/session/session';

function useCurrentUser(session: BlobWarsSession): { seat: PlayerSeat | null } {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.store.state.game.currentUser,
  );
}

export { useCurrentUser };
