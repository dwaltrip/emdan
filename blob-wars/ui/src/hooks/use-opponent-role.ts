import { useSyncExternalStore } from 'react';

import type { ClientRole } from '@shared/protocol';
import type { Session } from '@/session/session';

function useOpponentRole(session: Session): ClientRole | null {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.store.state.opponentRole,
  );
}

export { useOpponentRole };
