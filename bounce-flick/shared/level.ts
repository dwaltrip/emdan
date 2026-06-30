// Plain, serializable level types. These travel over the wire (player 1
// generates a level and the server relays it to player 2), so they live in
// shared/ and are re-exported from the ui's game/types.ts. Matter-backed
// runtime types (TerrainPiece, Runtime) stay in the ui.

export type Point = {
  x: number
  y: number
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
  finishPlatformIndex?: number
  finishX: number
  startPlatformIndex?: number
  startY: number
  terrain: TerrainSpec[]
}
