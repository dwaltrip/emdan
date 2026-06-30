import { describe, expect, it } from 'vitest'

import { offsetPolylineSegments } from '../../src/game/geometry'

describe('geometry helpers', () => {
  it('connects adjacent offset segments at polyline joins', () => {
    const segments = offsetPolylineSegments(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      2,
    )

    expect(segments).toHaveLength(3)
    expect(segments[1]).toEqual({
      from: segments[0].to,
      to: segments[2].from,
    })
  })
})
