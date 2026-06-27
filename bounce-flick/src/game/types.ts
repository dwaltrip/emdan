import type * as Matter from 'matter-js'

export type Phase = 'running' | 'cleared' | 'crashed'

export type Point = {
  x: number
  y: number
}

export type HudSnapshot = {
  ink: number
  maxInk: number
  phase: Phase
  progress: number
  speed: number
}

export type InkSegment = {
  body: Matter.Body
  from: Point
  to: Point
}

export type HazardDirection = 'up' | 'left' | 'right'

export type TerrainRole = 'ground' | 'hazard' | 'finish'

export type TerrainSpec = {
  angle?: number
  fill: string
  hazardDirection?: HazardDirection
  height: number
  role: TerrainRole
  stroke: string
  width: number
  x: number
  y: number
}

export type GeneratedLevel = {
  finishX: number
  startY: number
  terrain: TerrainSpec[]
}

export type TerrainPiece = {
  body: Matter.Body
  fill: string
  hazardDirection?: HazardDirection
  role: TerrainRole
  stroke: string
}

export type GameActions = {
  clearDrawings: () => void
}

export type Runtime = {
  ball: Matter.Body
  cameraX: number
  cameraY: number
  engine: Matter.Engine
  finishX: number
  ink: number
  inkSegments: InkSegment[]
  lastHudAt: number
  lastPointer: Point | null
  phase: Phase
  pointerId: number | null
  rafId: number
  terrain: TerrainPiece[]
  viewportHeight: number
  viewportWidth: number
}
