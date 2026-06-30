import type { GeneratedLevel, TerrainSpec } from '../../src/game/types'

// Hand-authored levels for the physics scenarios. style (fill/stroke/spikes)
// is render-only and irrelevant to the simulation, so these builders default it
// and expose only the physics-relevant shape. Rect coords are body centers,
// matching how terrain.ts builds Matter bodies.
const STYLE = { fill: '#000', stroke: '#000' }

function floor(
  x: number,
  y: number,
  width: number,
  height: number,
  angle = 0,
): TerrainSpec {
  return {
    deadly: false,
    kind: 'object',
    shape: { type: 'rect', x, y, width, height, angle },
    style: STYLE,
  }
}

function wall(x: number, y: number, width: number, height: number): TerrainSpec {
  return {
    deadly: false,
    kind: 'wall',
    shape: { type: 'rect', x, y, width, height },
    style: STYLE,
  }
}

function spikes(x: number, y: number, width: number, height: number): TerrainSpec {
  return {
    deadly: true,
    kind: 'object',
    shape: { type: 'rect', x, y, width, height },
    style: { ...STYLE, spikes: 'up' },
  }
}

function finish(x: number, y: number, width: number, height: number): TerrainSpec {
  return {
    deadly: false,
    kind: 'finish',
    shape: { type: 'rect', x, y, width, height },
    style: STYLE,
  }
}

// Scenario 1: a gentle downhill the ball rolls down into a tall finish band
// sitting right next to the spawn. Expected outcome: cleared.
export const slopeToFinish: GeneratedLevel = {
  finishX: 600,
  startY: 560,
  terrain: [floor(500, 660, 1100, 60, 0.1), finish(600, 520, 40, 360)],
}

// Scenario 2: a narrow chute funnels the spawn straight down onto spikes.
// Expected outcome: crashed.
export const chuteWithSpikes: GeneratedLevel = {
  finishX: 4000,
  startY: 360,
  terrain: [wall(95, 460, 30, 320), wall(185, 460, 30, 320), spikes(140, 600, 160, 60)],
}
