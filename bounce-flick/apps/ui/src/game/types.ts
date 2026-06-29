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

export type SpikeDirection = 'up' | 'down' | 'left' | 'right'

export type TerrainKind = 'wall' | 'object' | 'finish'

export type RectShape = {
  angle?: number
  height: number
  type: 'rect'
  width: number
  x: number
  y: number
}

export type PolylineShape = {
  points: Point[]
  thickness: number
  type: 'polyline'
}

export type TerrainShape = PolylineShape | RectShape

export type TerrainStyle = {
  fill: string
  spikes?: SpikeDirection
  stroke: string
}

export type TerrainSpec = {
  deadly: boolean
  kind: TerrainKind
  shape: TerrainShape
  style: TerrainStyle
}

export type GeneratedLevel = {
  finishX: number
  startY: number
  terrain: TerrainSpec[]
}

export type TerrainPiece = {
  bodies: Matter.Body[]
  bounds: Matter.Bounds
  deadly: boolean
  kind: TerrainKind
  shape: TerrainShape
  style: TerrainStyle
}

export type GameActions = {
  clearDrawings: () => void
}

export type Runtime = {
  ball: Matter.Body
  cameraFrozen: boolean
  cameraX: number
  cameraY: number
  engine: Matter.Engine
  finishX: number
  ink: number
  inkSegments: InkSegment[]
  lastHudAt: number
  lastPointer: Point | null
  pointerScreen: Point | null
  phase: Phase
  pointerId: number | null
  rafId: number
  terrain: TerrainPiece[]
  viewportHeight: number
  viewportWidth: number
}
