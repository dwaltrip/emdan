import { useSyncExternalStore } from 'react';

import type { PlayerSeat } from '@shared/protocol';
import type { Session } from '@/session/session';

function useCurrentUserSeat(session: Session): PlayerSeat | null {
  return useSyncExternalStore(
    session.store.subscribe,
    () => session.store.state.game.currentUser.seat,
  );
}

export { useCurrentUserSeat };
