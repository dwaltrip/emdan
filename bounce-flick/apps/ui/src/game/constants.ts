import type { HudSnapshot } from './types'

export {
  BALL_RADIUS,
  START_X,
  WALL_THICKNESS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@shared/game-config'

export const GRAVITY = 0.62
export const MAX_INK = 170
export const INK_RECHARGE_PER_SECOND = 64
export const INK_COST_PER_PIXEL = 0.42
export const INK_THICKNESS = 13
export const MIN_SEGMENT_LENGTH = 7
export const INK_ERASE_DISTANCE = 80
export const DRIVE_SPEED = 3.35
export const DRIVE_ACCELERATION = 0.075
export const MAX_SPEED = 9.4
export const FIXED_STEP = 1000 / 60
export const INITIAL_HUD: HudSnapshot = {
  ink: MAX_INK,
  maxInk: MAX_INK,
  phase: 'running',
  progress: 0,
  speed: 0,
}
