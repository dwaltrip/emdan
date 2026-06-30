import { describe, expect, it, vi } from 'vitest'

import { BALL_RADIUS, START_X } from '../../src/game/constants'
import { segmentYAt } from '../../src/game/geometry'
import { generateLevel } from '../../src/game/level'
import {
  corridorInnerFaces,
  finishPlatform,
  minVerticalGapAbove,
  platformTopEdge,
  seededRandom,
  startPlatform,
} from './generated-level'

// The ball must fit between a platform's surface and the corridor ceiling.
// The gap must be greater than the ball's diameter or the ball can't pass.
// This test asserts the basic constraint but doesn't assume any extra margin,
// as gameplay refinement work may tweak the margin for feel.
const BALL_HEIGHT = BALL_RADIUS * 2
const MIN_FINISH_DROP_FROM_START = 1450
const FLOAT_EPSILON = 0.000001
const SEED_COUNT = 300

describe('generated levels: ball fits between platforms and corridor', () => {
  it('keeps at least a ball-height of headroom over the start and finish platforms', () => {
    for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
      const level = generateLevel(seededRandom(seed))
      const { ceiling } = corridorInnerFaces(level)

      for (const [name, platform] of [
        ['start', startPlatform(level)],
        ['finish', finishPlatform(level)],
      ] as const) {
        const headroom = minVerticalGapAbove(ceiling, platformTopEdge(platform))

        expect(headroom, `seed ${seed}: ${name} platform is outside the corridor`).not.toBeNull()
        expect(
          headroom,
          `seed ${seed}: ${name} headroom ${headroom?.toFixed(0)} < ball height ${BALL_HEIGHT}`,
        ).toBeGreaterThanOrEqual(BALL_HEIGHT)
      }
    }
  })

  it('fits start and finish platforms without generator warnings', () => {
    const warnings: string[] = []
    let currentSeed = 0
    const warn = vi.spyOn(console, 'warn').mockImplementation((message) => {
      warnings.push(`seed ${currentSeed}: ${String(message)}`)
    })

    try {
      for (currentSeed = 1; currentSeed <= SEED_COUNT; currentSeed += 1) {
        generateLevel(seededRandom(currentSeed))
      }
    } finally {
      warn.mockRestore()
    }

    expect(warnings).toEqual([])
  })

  it('keeps the finish platform at least the minimum drop below the start platform', () => {
    for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
      const level = generateLevel(seededRandom(seed))
      const startSurfaceY = segmentYAt(
        platformTopEdge(startPlatform(level)),
        START_X,
      )
      const finishSurfaceY = segmentYAt(
        platformTopEdge(finishPlatform(level)),
        level.finishX,
      )

      expect(startSurfaceY, `seed ${seed}: start surface is missing`).not.toBeNull()
      expect(finishSurfaceY, `seed ${seed}: finish surface is missing`).not.toBeNull()
      expect(
        (finishSurfaceY ?? 0) - (startSurfaceY ?? 0),
        `seed ${seed}: finish drop is below ${MIN_FINISH_DROP_FROM_START}`,
      ).toBeGreaterThanOrEqual(MIN_FINISH_DROP_FROM_START - FLOAT_EPSILON)
    }
  })
})
