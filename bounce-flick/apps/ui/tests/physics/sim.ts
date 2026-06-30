import {
  advanceFrame,
  bindCollisionHandlers,
  createRuntime,
} from '../../src/game/physics'
import type { GeneratedLevel, Phase } from '../../src/game/types'

export interface SimResult {
  phase: Phase
  steps: number
  x: number
  y: number
}

// Headless driver: builds the real runtime for a level and pumps fixed steps
// (the same advanceFrame the render loop runs) until the phase leaves 'running'
// or the step budget is exhausted. No canvas, no RAF, no wall clock.
export function simulate(level: GeneratedLevel, maxSteps = 1200): SimResult {
  const runtime = createRuntime(level)
  const unbind = bindCollisionHandlers(runtime, () => {})

  let steps = 0
  for (; steps < maxSteps; steps += 1) {
    advanceFrame(runtime)
    if (runtime.phase !== 'running') {
      break
    }
  }

  unbind()
  return {
    phase: runtime.phase,
    steps,
    x: runtime.ball.position.x,
    y: runtime.ball.position.y,
  }
}
