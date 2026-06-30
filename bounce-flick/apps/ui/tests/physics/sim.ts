import {
  advanceFrame,
  bindCollisionHandlers,
  createRuntime,
} from '../../src/game/physics'
import type { GeneratedLevel, Phase, Runtime } from '../../src/game/types'

export interface SimResult {
  phase: Phase
  steps: number
  x: number
  y: number
}

export interface SimOptions {
  maxSteps?: number
  // Runs after the runtime is built but before stepping begins.
  // Used to set up the scenario, e.g. drawing an ink bridge.
  onReady?: (runtime: Runtime) => void
}

// Headless driver for a scenario. Builds the real runtime and advances it one
// fixed step at a time until the phase leaves 'running' or maxSteps is reached.
// Physics, logic, and state only. No UI or rendering.
// It simulates via `advanceFrame` to match how the core game loop works.
export function simulate(level: GeneratedLevel, options: SimOptions = {}): SimResult {
  const { maxSteps = 1200, onReady } = options
  const runtime = createRuntime(level)
  const unbind = bindCollisionHandlers(runtime, () => {})
  onReady?.(runtime)

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
