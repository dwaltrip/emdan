import { useSyncExternalStore } from 'react'

import type { SessionState } from '../net/session'
import { session } from '../net/session-instance'

export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState)
}
