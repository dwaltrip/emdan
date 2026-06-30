import type { ConnectionStatus, LobbyStatus } from '../net/session'

type JoinScreenProps = {
  status: ConnectionStatus
  lobby: LobbyStatus | null
  onJoin: () => void
  onStartNow: () => void
}

export function JoinScreen({
  status,
  lobby,
  onJoin,
  onStartNow,
}: JoinScreenProps) {
  return (
    <main className="join-screen">
      <h1>Bounce Flick</h1>
      {status !== 'connected' ? (
        <p>Connecting…</p>
      ) : lobby ? (
        <>
          <p>
            {lobby.playersConnected}{' '}
            {lobby.playersConnected === 1 ? 'player' : 'players'} in lobby
          </p>
          <button type="button" onClick={onStartNow} disabled={!lobby.ready}>
            {lobby.ready ? 'Start now' : 'Preparing course…'}
          </button>
        </>
      ) : (
        <button type="button" onClick={onJoin}>
          Join lobby
        </button>
      )}
    </main>
  )
}
