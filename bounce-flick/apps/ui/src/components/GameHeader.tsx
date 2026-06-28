import { getStatusText } from '../game/status'
import type { HudSnapshot } from '../game/types'

type GameHeaderProps = {
  hud: HudSnapshot
  onClearDrawings: () => void
  onRestart: () => void
}

export function GameHeader({
  hud,
  onClearDrawings,
  onRestart,
}: GameHeaderProps) {
  return (
    <header className="game-topbar">
      <div className="game-title">
        <span className="title-mark" aria-hidden="true" />
        <div>
          <h1>Bounce Flick</h1>
          <p>{getStatusText(hud.phase)}</p>
        </div>
      </div>

      <HudPanel hud={hud} />

      <div className="game-actions">
        <button type="button" onClick={onClearDrawings}>
          Clear ink
        </button>
        <button type="button" className="primary-action" onClick={onRestart}>
          Restart
        </button>
      </div>
    </header>
  )
}

function HudPanel({ hud }: { hud: HudSnapshot }) {
  return (
    <div className="hud-panel" aria-label="Game status">
      <div className="ink-readout">
        <span>Ink</span>
        <div className="ink-track" aria-hidden="true">
          <div
            className="ink-fill"
            style={{ width: `${(hud.ink / hud.maxInk) * 100}%` }}
          />
        </div>
      </div>
      <div className="stat-readout">
        <span>Progress</span>
        <strong>{Math.round(hud.progress)}%</strong>
      </div>
      <div className="stat-readout">
        <span>Speed</span>
        <strong>{hud.speed.toFixed(1)}</strong>
      </div>
    </div>
  )
}
