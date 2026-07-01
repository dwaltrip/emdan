import type { Point } from './types'

export type Segment = {
  from: Point
  to: Point
}

export type YRange = {
  maxY: number
  minY: number
}

const EPSILON = 0.000001

export function distanceBetween(from: Point, to: Point) {
  return Math.hypot(to.x - from.x, to.y - from.y)
}

export function pathLength(path: Point[]) {
  let length = 0

  for (let index = 1; index < path.length; index += 1) {
    length += distanceBetween(path[index - 1], path[index])
  }

  return length
}

export function polylineSegments(points: Point[]): Segment[] {
  const segments: Segment[] = []

  for (let index = 1; index < points.length; index += 1) {
    segments.push({ from: points[index - 1], to: points[index] })
  }

  return segments
}

// Offsets a polyline by moving each vertex along a smoothed vertex normal.
// This is useful for creating drawable wall centerlines from a routed path.
export function offsetPathByVertexNormal(path: Point[], offset: number) {
  return path.map((point, index) => {
    const normal = pathPointNormal(path, index)

    return {
      x: point.x + normal.x * offset,
      y: point.y + normal.y * offset,
    }
  })
}

// Offsets each segment independently, then connects adjacent offset segments.
// This is useful for approximating the inner face of thick wall bodies.
export function offsetSegment(segment: Segment, offset: number): Segment {
  const normal = segmentNormal(segment)

  return {
    from: {
      x: segment.from.x + normal.x * offset,
      y: segment.from.y + normal.y * offset,
    },
    to: {
      x: segment.to.x + normal.x * offset,
      y: segment.to.y + normal.y * offset,
    },
  }
}

export function offsetPolylineSegments(
  points: Point[],
  offset: number,
): Segment[] {
  const offsetSegments = polylineSegments(points).map((segment) =>
    offsetSegment(segment, offset),
  )
  const segments: Segment[] = []

  offsetSegments.forEach((segment, index) => {
    const previous = offsetSegments[index - 1]

    if (previous) {
      segments.push({ from: previous.to, to: segment.from })
    }

    segments.push(segment)
  })

  return segments.filter(
    (segment) => distanceBetween(segment.from, segment.to) > EPSILON,
  )
}

export function segmentSpanX(segment: Segment): { left: number; right: number } {
  return {
    left: Math.min(segment.from.x, segment.to.x),
    right: Math.max(segment.from.x, segment.to.x),
  }
}

export function segmentYAt(segment: Segment, x: number): number | null {
  const { left, right } = segmentSpanX(segment)

  if (x < left - EPSILON || x > right + EPSILON) {
    return null
  }

  if (Math.abs(segment.to.x - segment.from.x) < EPSILON) {
    return null
  }

  const progress = (x - segment.from.x) / (segment.to.x - segment.from.x)

  return segment.from.y + (segment.to.y - segment.from.y) * progress
}

export function segmentsYAt(
  segments: Segment[],
  x: number,
  pick: (a: number, b: number) => number,
): number | null {
  let result: number | null = null

  for (const segment of segments) {
    const y =
      Math.abs(segment.to.x - segment.from.x) < EPSILON &&
      Math.abs(x - segment.from.x) < EPSILON
        ? pick(segment.from.y, segment.to.y)
        : segmentYAt(segment, x)

    if (y === null) {
      continue
    }

    result = result === null ? y : pick(result, y)
  }

  return result
}

export function segmentsYRangeOverSpan(
  segments: Segment[],
  left: number,
  right: number,
): YRange | null {
  const lo = Math.min(left, right)
  const hi = Math.max(left, right)
  let range: YRange | null = null
  const consider = (y: number) => {
    range =
      range === null
        ? { maxY: y, minY: y }
        : { maxY: Math.max(range.maxY, y), minY: Math.min(range.minY, y) }
  }

  for (const segment of segments) {
    const span = segmentSpanX(segment)

    if (span.right < lo - EPSILON || span.left > hi + EPSILON) {
      continue
    }

    for (const point of [segment.from, segment.to]) {
      if (point.x >= lo - EPSILON && point.x <= hi + EPSILON) {
        consider(point.y)
      }
    }

    const leftY = segmentYAt(segment, lo)
    if (leftY !== null) {
      consider(leftY)
    }

    const rightY = segmentYAt(segment, hi)
    if (rightY !== null) {
      consider(rightY)
    }
  }

  return range
}

export function segmentXStops(
  segments: Segment[],
  fromX: number,
  toX: number,
): number[] {
  const lo = Math.min(fromX, toX)
  const hi = Math.max(fromX, toX)
  const xs = segments.flatMap((segment) => [segment.from.x, segment.to.x])
  const stops = [...new Set(xs.filter((x) => x > lo && x < hi))]

  return fromX <= toX ? stops.sort((a, b) => a - b) : stops.sort((a, b) => b - a)
}

function segmentNormal(segment: Segment): Point {
  const dx = segment.to.x - segment.from.x
  const dy = segment.to.y - segment.from.y
  const length = Math.hypot(dx, dy) || 1

  return {
    x: -dy / length,
    y: dx / length,
  }
}

function pathPointNormal(path: Point[], index: number) {
  const previous = path[Math.max(0, index - 1)]
  const next = path[Math.min(path.length - 1, index + 1)]
  const dx = next.x - previous.x
  const dy = next.y - previous.y
  const length = Math.hypot(dx, dy) || 1

  return {
    x: -dy / length,
    y: dx / length,
  }
}
