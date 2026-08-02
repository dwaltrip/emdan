// Plain, serializable level types. The server generates a level and sends it
// to every player, so these live in shared/ alongside the generator and wire
// protocol. Matter-backed runtime types (TerrainPiece, Runtime) stay in the UI.

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
