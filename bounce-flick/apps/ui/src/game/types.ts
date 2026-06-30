import type * as Matter from 'matter-js'

import type {
  Point,
  TerrainKind,
  TerrainShape,
  TerrainStyle,
} from '@shared/level'

// Re-export shared types for easier use in `apps/ui`
export type {
  GeneratedLevel,
  Point,
  PolylineShape,
  RectShape,
  SpikeDirection,
  TerrainKind,
  TerrainShape,
  TerrainSpec,
  TerrainStyle,
} from '@shared/level'

export type Phase = 'running' | 'cleared' | 'crashed'

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
  opponent: Point | null
  pointerScreen: Point | null
  phase: Phase
  pointerId: number | null
  rafId: number
  terrain: TerrainPiece[]
  viewportHeight: number
  viewportWidth: number
}
