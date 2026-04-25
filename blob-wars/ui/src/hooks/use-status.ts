import { useSyncExternalStore } from 'react';

import type { ConnectionStatus } from '@/board-store';
import type { Session } from '@/session/session';

function useStatus(session: Session): ConnectionStatus {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.store.state.connectionStatus,
  );
}

export { useStatus };
