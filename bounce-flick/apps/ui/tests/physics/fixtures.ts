// Hand-authored levels for the physics scenarios.

import type { GeneratedLevel, TerrainSpec } from '../../src/game/types'


// Render-only style fields (fill/stroke/spikes) are not used, but must be set.
const STYLE = { fill: 'rgb(0, 0, 0)', stroke: '#000' }

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

// Scenario 1: The ball spawns on a gentle downhill slope right before the finish.
// Expected: rolls down into the finish band -> "cleared"
export const slopeToFinish: GeneratedLevel = {
  finishX: 600,
  startY: 560,
  terrain: [floor(500, 660, 1100, 60, 0.1), finish(600, 520, 40, 360)],
}

// Scenario 2: The ball spawns directly above spikes with walls on both sides.
// Expected: falls downward landing on spikes -> "crashed"
export const chuteWithSpikes: GeneratedLevel = {
  finishX: 4000,
  startY: 360,
  terrain: [wall(95, 460, 30, 320), wall(185, 460, 30, 320), spikes(140, 600, 160, 60)],
}

// Scenario 3: A spike pit between two platforms
// Player must draw an ink bridge to cross safely.
// Layout: start platform -> gap with spikes -> landing -> finish.
// Expected: (1) falls into pit without the bridge and (2) crosses with the bridge.
export const inkBridgeGap: GeneratedLevel = {
  finishX: 900,
  startY: 560,
  terrain: [
    floor(120, 640, 320, 60),
    spikes(460, 780, 360, 60),
    floor(800, 640, 320, 60),
    finish(900, 520, 40, 360),
  ],
}

// Coordinates for an ink bridge that crosses the gap in Scenario 3.
// Lines up smoothly with platform. The test doesn't assume the ball can climb a lip.
export const inkBridgeSpan = { from: { x: 270, y: 616 }, to: { x: 650, y: 616 } }
