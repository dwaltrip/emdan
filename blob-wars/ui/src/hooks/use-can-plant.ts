import { useSyncExternalStore } from 'react';

import type { Session } from '@/session/session';

function useCanPlant(session: Session): boolean {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.canPlant(),
  );
}

export { useCanPlant };
