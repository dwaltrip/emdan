import { useSyncExternalStore } from 'react';

import type { BlobWarsSession } from '@/blob-wars/session';

function useMatchId(session: BlobWarsSession): string | null {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.store.state.game.matchId,
  );
}

export { useMatchId };
