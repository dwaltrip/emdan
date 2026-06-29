import { useCallback, useRef, useState } from 'react'

import { INITIAL_HUD } from '../game/constants'
import type { GameActions, GeneratedLevel } from '../game/types'
import { useBounceFlickGame } from '../hooks/useBounceFlickGame'
import { GameHeader } from './GameHeader'
import { GameStage } from './GameStage'

export function Game({ level }: { level: GeneratedLevel }) {
  // Restart re-runs the same agreed level (not a fresh one) by remounting the
  // run. Bumping the key tears down the old runtime and builds a new one.
  const [runKey, setRunKey] = useState(0)
  const restart = useCallback(() => setRunKey((key) => key + 1), [])

  return <GameRun key={runKey} level={level} onRestart={restart} />
}

function GameRun({
  level,
  onRestart,
}: {
  level: GeneratedLevel
  onRestart: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const actionsRef = useRef<GameActions | null>(null)
  const [hud, setHud] = useState(INITIAL_HUD)

  useBounceFlickGame({ actionsRef, canvasRef, level, setHud })

  const clearDrawings = useCallback(() => {
    actionsRef.current?.clearDrawings()
  }, [])

  return (
    <main className="game-shell">
      <GameHeader hud={hud} onClearDrawings={clearDrawings} onRestart={onRestart} />
      <GameStage canvasRef={canvasRef} hud={hud} />
    </main>
  )
}
