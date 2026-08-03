import type { JoinState } from '../net/session';

type JoinScreenProps = {
  onJoin: () => void;
  onStartNow: () => void;
  state: JoinState;
};

export function JoinScreen({ state, onJoin, onStartNow }: JoinScreenProps) {
  return (
    <main className="join-screen">
      <h1>Bounce Flick</h1>
      {state.phase === 'connecting' ? (
        <p>Connecting…</p>
      ) : state.phase === 'disconnected' ? (
        <p>Connection lost.</p>
      ) : state.phase === 'lobby' ? (
        <>
          <p>
            {state.playersConnected} {state.playersConnected === 1 ? 'player' : 'players'} in lobby
          </p>
          <button type="button" onClick={onStartNow} disabled={!state.canStart}>
            Start now
          </button>
        </>
      ) : (
        <button type="button" onClick={onJoin}>
          Join lobby
        </button>
      )}
    </main>
  );
}
