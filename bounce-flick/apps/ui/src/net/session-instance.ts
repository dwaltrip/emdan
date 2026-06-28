import { createSession } from './session'

const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  `ws://${window.location.hostname}:3002`

// Module-level singleton: one socket that outlives any React mount. Nothing
// imports this yet — the UI wiring lands alongside the ball-update follow-up.
export const session = createSession(WS_URL)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    session.end()
  })
}
