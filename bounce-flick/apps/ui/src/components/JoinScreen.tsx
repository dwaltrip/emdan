import type { ConnectionStatus, LobbyStatus } from '../net/session'

type JoinScreenProps = {
  status: ConnectionStatus
  lobby: LobbyStatus | null
  onJoin: () => void
}

export function JoinScreen({ status, lobby, onJoin }: JoinScreenProps) {
  return (
    <main className="join-screen">
      <h1>Bounce Flick</h1>
      {status !== 'connected' ? (
        <p>Connecting…</p>
      ) : lobby ? (
        <p>
          Waiting for opponent… ({lobby.playersConnected}/{lobby.requiredPlayers})
        </p>
      ) : (
        <button type="button" onClick={onJoin}>
          Join lobby
        </button>
      )}
    </main>
  )
}
