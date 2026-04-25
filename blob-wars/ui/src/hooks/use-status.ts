import { useSyncExternalStore } from 'react';

import type { ConnectionStatus } from '@/board-store';
import type { BlobWarsSession } from '@/session/session';

function useStatus(session: BlobWarsSession): ConnectionStatus {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.store.state.connectionStatus,
  );
}

export { useStatus };
