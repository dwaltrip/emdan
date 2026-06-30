import { generateLevel } from '../game/level'

import { createSession } from './session'

const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  `ws://${window.location.hostname}:3002`

// Module-level singleton
export const session = createSession(WS_URL, { generateLevel })

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    session.end()
  })
}
