import type { RefObject } from 'react'
import { getStatusText } from '../game/status'
import type { HudSnapshot } from '../game/types'

type GameStageProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>
  hud: HudSnapshot
}

export function GameStage({ canvasRef, hud }: GameStageProps) {
  return (
    <section className="game-stage" aria-label="Bounce Flick playfield">
      <canvas ref={canvasRef} />
      <div className={`stage-badge ${hud.phase}`} aria-live="polite">
        <span>{getStatusText(hud.phase)}</span>
        <strong>{Math.round(hud.ink)}</strong>
      </div>
    </section>
  )
}
