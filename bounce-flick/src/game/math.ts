import type { Point } from './types'

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const distance = (from: Point, to: Point) =>
  Math.hypot(to.x - from.x, to.y - from.y)
