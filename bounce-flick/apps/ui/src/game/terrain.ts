import * as Matter from 'matter-js'
import type { GeneratedLevel, Point, TerrainPiece, TerrainSpec } from './types'

export function createTerrain(engine: Matter.Engine, level: GeneratedLevel) {
  return level.terrain.map((spec): TerrainPiece => {
    const bodies = createTerrainBodies(spec)

    Matter.Composite.add(engine.world, bodies)
    return {
      bodies,
      bounds: combineBodyBounds(bodies),
      deadly: spec.deadly,
      kind: spec.kind,
      shape: spec.shape,
      style: spec.style,
    }
  })
}

function createTerrainBodies(spec: TerrainSpec) {
  const label = spec.kind === 'finish' ? 'finish' : spec.deadly ? 'deadly' : spec.kind
  const { shape } = spec

  if (shape.type === 'polyline') {
    return createPolylineBodies(spec, label)
  }

  return [
    Matter.Bodies.rectangle(
      shape.x,
      shape.y,
      shape.width,
      shape.height,
      createBodyOptions(spec, label, shape.angle ?? 0),
    ),
  ]
}

function createPolylineBodies(spec: TerrainSpec, label: string) {
  if (spec.shape.type !== 'polyline') {
    return []
  }

  const bodies: Matter.Body[] = []

  for (let index = 1; index < spec.shape.points.length; index += 1) {
    const from = spec.shape.points[index - 1]
    const to = spec.shape.points[index]
    const length = distanceBetween(from, to)

    if (length < 1) {
      continue
    }

    bodies.push(
      Matter.Bodies.rectangle(
        (from.x + to.x) / 2,
        (from.y + to.y) / 2,
        length,
        spec.shape.thickness,
        createBodyOptions(spec, label, segmentAngle(from, to)),
      ),
    )
  }

  return bodies
}

function createBodyOptions(
  spec: TerrainSpec,
  label: string,
  angle: number,
): Matter.IChamferableBodyDefinition {
  const isSensor = spec.deadly || spec.kind === 'finish'
  const options: Matter.IChamferableBodyDefinition = {
    angle,
    isSensor,
    isStatic: true,
    label,
  }

  if (!isSensor) {
    options.friction = 0.92
    options.restitution = 0.03

    if (spec.kind === 'object') {
      options.chamfer = { radius: 12 }
    }
  }

  return options
}

function combineBodyBounds(bodies: Matter.Body[]): Matter.Bounds {
  const firstBody = bodies[0]

  if (!firstBody) {
    return {
      max: { x: 0, y: 0 },
      min: { x: 0, y: 0 },
    }
  }

  const bounds = {
    max: {
      x: firstBody.bounds.max.x,
      y: firstBody.bounds.max.y,
    },
    min: {
      x: firstBody.bounds.min.x,
      y: firstBody.bounds.min.y,
    },
  }

  bodies.slice(1).forEach((body) => {
    bounds.min.x = Math.min(bounds.min.x, body.bounds.min.x)
    bounds.min.y = Math.min(bounds.min.y, body.bounds.min.y)
    bounds.max.x = Math.max(bounds.max.x, body.bounds.max.x)
    bounds.max.y = Math.max(bounds.max.y, body.bounds.max.y)
  })

  return bounds
}

function segmentAngle(from: Point, to: Point) {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

function distanceBetween(from: Point, to: Point) {
  return Math.hypot(to.x - from.x, to.y - from.y)
}
