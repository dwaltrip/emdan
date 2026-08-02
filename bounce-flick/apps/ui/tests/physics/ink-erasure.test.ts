import * as Matter from 'matter-js'
import { describe, expect, it } from 'vitest'

import {
  addInkSegment,
  createRuntime,
  destroyRuntime,
  eraseRecentInk,
} from '../../src/game/physics'
import type { GeneratedLevel, Runtime } from '../../src/game/types'

const EMPTY_LEVEL: GeneratedLevel = {
  finishX: 1000,
  startY: 300,
  terrain: [],
}

function withRuntime(test: (runtime: Runtime) => void) {
  const runtime = createRuntime(EMPTY_LEVEL)

  try {
    test(runtime)
  } finally {
    destroyRuntime(runtime)
  }
}

describe('eraseRecentInk', () => {
  it('erases backward by distance across stored segments', () => {
    withRuntime((runtime) => {
      addInkSegment(runtime, { x: 100, y: 200 }, { x: 150, y: 200 })
      addInkSegment(runtime, { x: 200, y: 200 }, { x: 240, y: 200 })
      addInkSegment(runtime, { x: 300, y: 200 }, { x: 330, y: 200 })

      const replacedBody = runtime.inkSegments[1].body
      const removedBody = runtime.inkSegments[2].body
      const erasedDistance = eraseRecentInk(runtime, 60)
      const bodies = Matter.Composite.allBodies(runtime.engine.world)

      expect(erasedDistance).toBe(60)
      expect(runtime.inkSegments).toHaveLength(2)
      expect(runtime.inkSegments[1].from).toEqual({ x: 200, y: 200 })
      expect(runtime.inkSegments[1].to).toEqual({ x: 210, y: 200 })
      expect(runtime.inkSegments[1].body.position.x).toBeCloseTo(205)
      expect(bodies).not.toContain(replacedBody)
      expect(bodies).not.toContain(removedBody)
      expect(bodies).toContain(runtime.inkSegments[1].body)
    })
  })

  it('removes a remainder that would be too short to keep', () => {
    withRuntime((runtime) => {
      addInkSegment(runtime, { x: 100, y: 200 }, { x: 110, y: 200 })

      expect(eraseRecentInk(runtime, 4)).toBe(10)
      expect(runtime.inkSegments).toHaveLength(0)
    })
  })

  it('eventually removes all ink without refunding it', () => {
    withRuntime((runtime) => {
      addInkSegment(runtime, { x: 100, y: 200 }, { x: 220, y: 200 })
      const inkAfterDrawing = runtime.ink

      expect(eraseRecentInk(runtime)).toBe(80)
      expect(runtime.inkSegments).toHaveLength(1)
      expect(eraseRecentInk(runtime)).toBe(40)
      expect(runtime.inkSegments).toHaveLength(0)
      expect(runtime.ink).toBe(inkAfterDrawing)
      expect(eraseRecentInk(runtime)).toBe(0)
    })
  })
})
