import { describe, expect, it } from 'vitest'
import { addInkSegment } from '../../src/game/physics'
import {
  chuteWithSpikes,
  inkBridgeGap,
  inkBridgeSpan,
  slopeToFinish,
} from './fixtures'
import { simulate } from './sim'

describe('level scenarios', () => {
  it('ball on simple slope crosses the finish line', () => {
    const { phase } = simulate(slopeToFinish)
    expect(phase).toBe('cleared')
  })

  it('ball spawning above spikes crashes and dies', () => {
    const { phase } = simulate(chuteWithSpikes)
    expect(phase).toBe('crashed')
  })

  it('ball crosses a spike pit on a drawn ink bridge', () => {
    const { phase } = simulate(inkBridgeGap, {
      onReady: (runtime) =>
        addInkSegment(runtime, inkBridgeSpan.from, inkBridgeSpan.to),
    })
    expect(phase).toBe('cleared')
  })

  it('ball falls into the spike pit without an ink bridge', () => {
    const { phase } = simulate(inkBridgeGap)
    expect(phase).toBe('crashed')
  })
})
