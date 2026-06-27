import { useCallback, useRef, useState } from 'react'
import { GameHeader } from './components/GameHeader'
import { GameStage } from './components/GameStage'
import './App.css'
import { INITIAL_HUD } from './game/constants'
import { generateLevel } from './game/level'
import type { GameActions } from './game/types'
import { useBounceFlickGame } from './hooks/useBounceFlickGame'

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const actionsRef = useRef<GameActions | null>(null)
  const [hud, setHud] = useState(INITIAL_HUD)
  const [level, setLevel] = useState(() => generateLevel())

  useBounceFlickGame({
    actionsRef,
    canvasRef,
    level,
    setHud,
  })

  const restartGame = useCallback(() => {
    setHud(INITIAL_HUD)
    setLevel(generateLevel())
  }, [])

  const clearDrawings = useCallback(() => {
    actionsRef.current?.clearDrawings()
  }, [])

  return (
    <main className="game-shell">
      <GameHeader
        hud={hud}
        onClearDrawings={clearDrawings}
        onRestart={restartGame}
      />
      <GameStage canvasRef={canvasRef} hud={hud} />
    </main>
  )
}

export default App
