import * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  DRIVE_ACCELERATION,
  DRIVE_SPEED,
  GRAVITY,
  INK_COST_PER_PIXEL,
  INK_RECHARGE_PER_SECOND,
  INK_THICKNESS,
  MAX_INK,
  MAX_SPEED,
  MIN_SEGMENT_LENGTH,
  START_X,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants'
import { createTerrain } from './level'
import { clamp, distance } from './math'
import type {
  GeneratedLevel,
  HudSnapshot,
  InkSegment,
  Phase,
  Point,
  Runtime,
} from './types'

export function createRuntime(level: GeneratedLevel): Runtime {
  const engine = Matter.Engine.create()
  engine.gravity.y = GRAVITY
  engine.positionIterations = 8
  engine.velocityIterations = 8

  const terrain = createTerrain(engine, level)
  const ball = Matter.Bodies.circle(START_X, level.startY, BALL_RADIUS, {
    density: 0.004,
    friction: 0.04,
    frictionAir: 0.005,
    label: 'ball',
    restitution: 0.5,
  })

  Matter.Composite.add(engine.world, ball)

  return {
    ball,
    cameraX: 0,
    cameraY: clamp(level.startY - 560 * 0.44, 0, WORLD_HEIGHT - 560),
    engine,
    finishX: level.finishX,
    ink: MAX_INK,
    inkSegments: [],
    lastHudAt: 0,
    lastPointer: null,
    phase: 'running',
    pointerId: null,
    rafId: 0,
    terrain,
    viewportHeight: 560,
    viewportWidth: 960,
  }
}

export function destroyRuntime(runtime: Runtime) {
  Matter.Composite.clear(runtime.engine.world, false)
  Matter.Engine.clear(runtime.engine)
}

export function createHudSnapshot(runtime: Runtime): HudSnapshot {
  return {
    ink: runtime.ink,
    maxInk: MAX_INK,
    phase: runtime.phase,
    progress: clamp(
      ((runtime.ball.position.x - START_X) / (runtime.finishX - START_X)) *
        100,
      0,
      100,
    ),
    speed: Math.hypot(runtime.ball.velocity.x, runtime.ball.velocity.y),
  }
}

export function setPhase(runtime: Runtime, phase: Phase) {
  if (runtime.phase === phase) {
    return false
  }

  runtime.phase = phase
  if (phase !== 'running') {
    Matter.Body.setVelocity(runtime.ball, {
      x: 0,
      y: runtime.ball.velocity.y,
    })
    Matter.Body.setAngularVelocity(runtime.ball, 0)
  }

  return true
}

export function handleCollision(
  runtime: Runtime,
  event: Matter.IEventCollision<Matter.Engine>,
) {
  let didChangePhase = false

  event.pairs.forEach((pair) => {
    const labels = [pair.bodyA.label, pair.bodyB.label]
    if (!labels.includes('ball')) {
      return
    }

    if (labels.includes('hazard')) {
      didChangePhase = setPhase(runtime, 'crashed') || didChangePhase
    }

    if (labels.includes('finish')) {
      didChangePhase = setPhase(runtime, 'cleared') || didChangePhase
    }
  })

  return didChangePhase
}

export function bindCollisionHandlers(
  runtime: Runtime,
  onPhaseChange: () => void,
) {
  const collisionHandler = (event: Matter.IEventCollision<Matter.Engine>) => {
    if (handleCollision(runtime, event)) {
      onPhaseChange()
    }
  }

  Matter.Events.on(runtime.engine, 'collisionStart', collisionHandler)

  return () => {
    Matter.Events.off(runtime.engine, 'collisionStart', collisionHandler)
  }
}

export function stepEngine(runtime: Runtime, stepMs: number) {
  if (runtime.phase === 'running') {
    Matter.Engine.update(runtime.engine, stepMs)
  }
}

export function tickPhysics(runtime: Runtime, seconds: number) {
  let didChangePhase = false

  runtime.ink = clamp(
    runtime.ink + INK_RECHARGE_PER_SECOND * seconds,
    0,
    MAX_INK,
  )

  if (runtime.phase !== 'running') {
    return didChangePhase
  }

  if (runtime.ball.velocity.x < DRIVE_SPEED) {
    Matter.Body.setVelocity(runtime.ball, {
      x: Math.min(
        DRIVE_SPEED,
        runtime.ball.velocity.x + DRIVE_ACCELERATION,
      ),
      y: runtime.ball.velocity.y,
    })
  }

  if (runtime.ball.velocity.x > MAX_SPEED) {
    Matter.Body.setVelocity(runtime.ball, {
      x: MAX_SPEED,
      y: runtime.ball.velocity.y,
    })
  }

  if (runtime.ball.velocity.y > 16) {
    Matter.Body.setVelocity(runtime.ball, {
      x: runtime.ball.velocity.x,
      y: 16,
    })
  }

  if (runtime.ball.position.y > WORLD_HEIGHT + 150) {
    didChangePhase = setPhase(runtime, 'crashed') || didChangePhase
  }

  if (runtime.ball.position.x > runtime.finishX + 120) {
    didChangePhase = setPhase(runtime, 'cleared') || didChangePhase
  }

  return didChangePhase
}

export function screenToWorld(
  runtime: Runtime,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Point {
  const bounds = canvas.getBoundingClientRect()
  return {
    x: clientX - bounds.left + runtime.cameraX,
    y: clientY - bounds.top + runtime.cameraY,
  }
}

export function clampDrawingPoint(point: Point): Point {
  return {
    x: clamp(point.x, 18, WORLD_WIDTH - 18),
    y: clamp(point.y, 80, WORLD_HEIGHT - 22),
  }
}

export function addInkSegment(runtime: Runtime, from: Point, target: Point) {
  const fullLength = distance(from, target)
  if (fullLength < MIN_SEGMENT_LENGTH || runtime.ink <= 0.4) {
    return from
  }

  const affordableLength = Math.min(
    fullLength,
    runtime.ink / INK_COST_PER_PIXEL,
  )
  if (affordableLength < MIN_SEGMENT_LENGTH) {
    return from
  }

  const ratio = affordableLength / fullLength
  const to = {
    x: from.x + (target.x - from.x) * ratio,
    y: from.y + (target.y - from.y) * ratio,
  }
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const body = Matter.Bodies.rectangle(
    midX,
    midY,
    affordableLength,
    INK_THICKNESS,
    {
      angle,
      chamfer: { radius: INK_THICKNESS / 2 },
      friction: 0.96,
      isStatic: true,
      label: 'ink',
      restitution: 0.05,
    },
  )
  const segment: InkSegment = { body, from, to }

  Matter.Composite.add(runtime.engine.world, body)
  runtime.inkSegments.push(segment)
  runtime.ink -= affordableLength * INK_COST_PER_PIXEL

  return to
}

export function clearDrawings(runtime: Runtime) {
  runtime.inkSegments.forEach((segment) => {
    Matter.Composite.remove(runtime.engine.world, segment.body)
  })
  runtime.inkSegments = []
}
