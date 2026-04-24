import { useSyncExternalStore } from 'react';

import type { PlayerSeat } from '@shared/protocol';
import type { BlobWarsSession } from '@/blob-wars/session';

function useCurrentUser(session: BlobWarsSession): { seat: PlayerSeat | null } {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.store.state.game.currentUser,
  );
}

export { useCurrentUser };
