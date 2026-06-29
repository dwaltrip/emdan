import type { MatchResult } from '../net/session'

type ResultScreenProps = {
  result: MatchResult
  onPlayAgain: () => void
}

export function ResultScreen({ result, onPlayAgain }: ResultScreenProps) {
  const otherSeat = result.seat === 'player1' ? 'player2' : 'player1'
  const myTime = result.seat ? result.times[result.seat] : null
  const theirTime = result.times[otherSeat]

  return (
    <main className="join-screen">
      <h1>{outcomeText(result)}</h1>
      {result.reason === 'finished' && (
        <p>
          You: {formatTime(myTime)} · Opponent: {formatTime(theirTime)}
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
