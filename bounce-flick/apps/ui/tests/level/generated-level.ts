// Helpers for asserting properties of emitted GeneratedLevel data.
//
// These read only the public level schema: terrain pieces identified by kind
// and shape. Assumes no knowledge of level generator internal types.

import {
  offsetPolylineSegments,
  segmentSpanX,
  segmentsYAt,
} from '../../src/game/geometry'
import type { Segment } from '../../src/game/geometry'
import type {
  GeneratedLevel,
  Point,
  PolylineShape,
  RectShape,
  TerrainSpec,
} from '../../src/game/types'

// mulberry32: deterministic [0,1) PRNG, so a seed reproduces a level exactly.
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return function random() {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function corridorInnerFaces(level: GeneratedLevel): {
  ceiling: Segment[]
  floor: Segment[]
} {
  const walls = level.terrain.filter((piece) => piece.kind === 'wall')
  if (walls.length !== 2) {
    throw new Error(`expected 2 corridor walls, found ${walls.length}`)
  }

  const [top, bottom] = [...walls].sort((a, b) => meanPolylineY(a) - meanPolylineY(b))

  return {
    ceiling: wallInnerFace(top, 1), // interior is below the top wall
    floor: wallInnerFace(bottom, -1), // interior is above the bottom wall
  }
}

export function platformTopEdge(spec: TerrainSpec): Segment {
  const { x, y, width, height, angle = 0 } = rectOf(spec)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const corner = (dx: number, dy: number): Point => ({
    x: x + dx * cos - dy * sin,
    y: y + dx * sin + dy * cos,
  })
  const halfWidth = width / 2
  const halfHeight = height / 2
  const edgeA: Segment = {
    from: corner(-halfWidth, -halfHeight),
    to: corner(halfWidth, -halfHeight),
  }
  const edgeB: Segment = {
    from: corner(-halfWidth, halfHeight),
    to: corner(halfWidth, halfHeight),
  }
  const meanY = (edge: Segment) => (edge.from.y + edge.to.y) / 2
  return meanY(edgeA) <= meanY(edgeB) ? edgeA : edgeB
}

export function startPlatform(level: GeneratedLevel): TerrainSpec {
  return platformAtIndex(level, level.startPlatformIndex, 'startPlatformIndex')
}

export function finishPlatform(level: GeneratedLevel): TerrainSpec {
  return platformAtIndex(level, level.finishPlatformIndex, 'finishPlatformIndex')
}

export function minVerticalGapAbove(
  ceiling: Segment[],
  surface: Segment,
  samples = 24,
): number | null {
  const { left, right } = segmentSpanX(surface)
  let min: number | null = null
  for (let step = 0; step <= samples; step += 1) {
    const x = left + ((right - left) * step) / samples
    // Lowest-hanging ceiling point binds (largest y = closest to the platform).
    const ceilingY = segmentsYAt(ceiling, x, Math.max)
    if (ceilingY === null) {
      continue
    }
    const surfaceY =
      surface.from.y +
      ((surface.to.y - surface.from.y) * (x - surface.from.x)) /
        (surface.to.x - surface.from.x)
    const headroom = surfaceY - ceilingY
    min = min === null ? headroom : Math.min(min, headroom)
  }
  return min
}

function platformAtIndex(
  level: GeneratedLevel,
  index: number | undefined,
  field: 'finishPlatformIndex' | 'startPlatformIndex',
): TerrainSpec {
  if (index === undefined) {
    throw new Error(`generated level is missing ${field}`)
  }

  const platform = level.terrain[index]
  if (
    !platform ||
    platform.kind !== 'object' ||
    platform.deadly ||
    platform.shape.type !== 'rect'
  ) {
    throw new Error(`${field}=${index} does not point at a platform`)
  }

  return platform
}

function wallInnerFace(spec: TerrainSpec, towardInterior: 1 | -1): Segment[] {
  const { points, thickness } = polylineOf(spec)
  return offsetPolylineSegments(points, (towardInterior * thickness) / 2)
}

function meanPolylineY(spec: TerrainSpec) {
  const { points } = polylineOf(spec)
  return points.reduce((sum: number, point: Point) => sum + point.y, 0) / points.length
}

function polylineOf(spec: TerrainSpec): PolylineShape {
  if (spec.shape.type !== 'polyline') {
    throw new Error(`expected a polyline shape, got ${spec.shape.type}`)
  }
  return spec.shape
}

function rectOf(spec: TerrainSpec): RectShape {
  if (spec.shape.type !== 'rect') {
    throw new Error(`expected a rect shape, got ${spec.shape.type}`)
  }
  return spec.shape
}
