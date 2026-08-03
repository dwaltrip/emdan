// Hand-authored semantic levels for the physics scenarios.

import type { GeneratedLevel, HazardSpec, PlatformSpec, Rect } from '../../src/game/types';

function platform(rect: Rect): PlatformSpec {
  return { rect, role: 'scattered', skin: 0, type: 'platform' };
}

function hazard(rect: Rect): HazardSpec {
  return { rect, type: 'hazard' };
}

// The ball spawns on a gentle downhill slope right before the goal.
export const slopeToFinish: GeneratedLevel = {
  goal: { x: 600, y: 520, width: 40, height: 360 },
  pieces: [platform({ x: 500, y: 660, width: 1100, height: 60, angle: 0.1 })],
  spawn: { x: 140, y: 560 },
};

// The ball spawns directly above a hazard with solid guides on both sides.
export const chuteWithHazard: GeneratedLevel = {
  goal: { x: 4000, y: 400, width: 40, height: 360 },
  pieces: [
    platform({ x: 95, y: 460, width: 30, height: 320 }),
    platform({ x: 185, y: 460, width: 30, height: 320 }),
    hazard({ x: 140, y: 600, width: 160, height: 60 }),
  ],
  spawn: { x: 140, y: 360 },
};

// A lethal pit between two platforms. The player must draw an ink bridge.
export const inkBridgeGap: GeneratedLevel = {
  goal: { x: 900, y: 520, width: 40, height: 360 },
  pieces: [
    platform({ x: 120, y: 640, width: 320, height: 60 }),
    hazard({ x: 460, y: 780, width: 360, height: 60 }),
    platform({ x: 800, y: 640, width: 320, height: 60 }),
  ],
  spawn: { x: 140, y: 560 },
};

export const inkBridgeSpan = { from: { x: 270, y: 616 }, to: { x: 650, y: 616 } };
