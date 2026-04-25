import { useSyncExternalStore } from 'react';

import type { Session } from '@/session/session';

function useMatchId(session: Session): string | null {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.store.state.game.matchId,
  );
}

export { useMatchId };
