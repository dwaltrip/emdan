import { describe, expect, it } from 'vitest'
import { chuteWithSpikes, slopeToFinish } from './fixtures'
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
})
