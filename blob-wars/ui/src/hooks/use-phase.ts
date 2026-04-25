import { useSyncExternalStore } from 'react';

import type { MatchPhase } from '@shared/protocol';
import type { Session } from '@/session/session';

function usePhase(session: Session): MatchPhase {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.store.state.game.phase,
  );
}

export { usePhase };
