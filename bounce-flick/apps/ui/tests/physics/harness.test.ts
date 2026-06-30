import { describe, expect, it } from 'vitest'
import type { GeneratedLevel } from '../../src/game/types'
import { simulate } from './sim'

// Temporary end-to-end check that the harness wiring works: vitest + the
// @shared alias + matter-js running headless + advanceFrame stepping the world.
// Remove once the real scenario tests land. A level with no terrain lets the
// ball fall until it goes out of bounds, which trips the 'crashed' phase.
const emptyLevel: GeneratedLevel = {
  finishX: 4000,
  startY: 300,
  terrain: [],
}

describe('physics harness', () => {
  it('runs the simulation and reaches a terminal phase', () => {
    const result = simulate(emptyLevel)
    expect(result.phase).toBe('crashed')
    expect(result.steps).toBeGreaterThan(0)
  })
})
