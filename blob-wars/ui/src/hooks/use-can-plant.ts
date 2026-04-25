import { useSyncExternalStore } from 'react';

import type { BlobWarsSession } from '@/session/session';

function useCanPlant(session: BlobWarsSession): boolean {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.canPlant(),
  );
}

export { useCanPlant };
