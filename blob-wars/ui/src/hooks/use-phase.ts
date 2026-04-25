import { useSyncExternalStore } from 'react';

import type { MatchPhase } from '@shared/protocol';
import type { BlobWarsSession } from '@/session/session';

function usePhase(session: BlobWarsSession): MatchPhase {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.store.state.game.phase,
  );
}

export { usePhase };
