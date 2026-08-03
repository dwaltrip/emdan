import type { MatchResult } from '../net/session';

type ResultScreenProps = {
  onPlayAgain: () => void;
  result: MatchResult;
};

export function ResultScreen({ result, onPlayAgain }: ResultScreenProps) {
  const { outcome } = result;
  const myTime =
    outcome.type === 'finished' ? outcome.times.find(({ seat }) => seat === result.seat) : null;
  const otherTimes =
    outcome.type === 'finished'
      ? outcome.times.filter(({ seat }) => seat !== result.seat).map(({ elapsedMs }) => elapsedMs)
      : [];

  return (
    <main className="join-screen">
      <h1>{outcomeText(result)}</h1>
      {outcome.type === 'finished' && (
        <p>
          You: {formatTime(myTime?.elapsedMs)}
          {otherTimes.length > 0 && <> · Others: {otherTimes.map(formatTime).join(', ')}</>}
        </p>
      )}
      <button type="button" onClick={onPlayAgain}>
        Play again
      </button>
    </main>
  );
}

function outcomeText({ outcome, seat }: MatchResult): string {
  if (outcome.type === 'aborted') {
    return 'Opponent left';
  }
  if (outcome.winner === 'draw') {
    return 'Draw!';
  }
  return outcome.winner === seat ? 'You win!' : 'You lose';
}

function formatTime(ms: number | undefined): string {
  return ms === undefined ? '—' : `${(ms / 1000).toFixed(1)}s`;
}
