import type { MatchResult } from '../net/session'

type ResultScreenProps = {
  result: MatchResult
  onPlayAgain: () => void
}

export function ResultScreen({ result, onPlayAgain }: ResultScreenProps) {
  const myTime = result.seat ? result.times[result.seat] : null
  const opponentTimes = Object.entries(result.times)
    .filter(([seat]) => seat !== result.seat)
    .map(([, time]) => time)

  return (
    <main className="join-screen">
      <h1>{outcomeText(result)}</h1>
      {result.reason === 'finished' && (
        <p>
          You: {formatTime(myTime)}
          {opponentTimes.length > 0 && (
            <> · Others: {opponentTimes.map(formatTime).join(', ')}</>
          )}
        </p>
      )}
      <button type="button" onClick={onPlayAgain}>
        Play again
      </button>
    </main>
  )
}

function outcomeText(result: MatchResult): string {
  if (result.reason === 'disconnect') {
    return 'Opponent left'
  }
  if (result.winner === 'draw') {
    return 'Draw!'
  }
  return result.winner === result.seat ? 'You win!' : 'You lose'
}

function formatTime(ms: number | null): string {
  return ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`
}
