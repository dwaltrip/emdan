import './App.css'
import { Game } from './components/Game'
import { JoinScreen } from './components/JoinScreen'
import { useSession } from './hooks/useSession'
import { session } from './net/session-instance'

function App() {
  const state = useSession()

  if (state.started && state.level) {
    return <Game level={state.level} />
  }

  return (
    <JoinScreen
      status={state.status}
      lobby={state.lobby}
      onJoin={session.joinLobby}
    />
  )
}

export default App
