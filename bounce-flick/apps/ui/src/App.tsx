import './App.css';
import { Game } from './components/Game';
import { JoinScreen } from './components/JoinScreen';
import { ResultScreen } from './components/ResultScreen';
import { useSession } from './hooks/useSession';
import { session } from './net/session-instance';

function App() {
  const state = useSession();

  if (state.phase === 'ended') {
    return <ResultScreen result={state.result} onPlayAgain={session.joinLobby} />;
  }

  if (state.phase === 'playing') {
    return <Game level={state.level} multiplayer={session.multiplayer} />;
  }

  return <JoinScreen state={state} onJoin={session.joinLobby} onStartNow={session.startNow} />;
}

export default App;
