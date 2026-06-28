import {
  BALL_RADIUS,
  START_X,
  WALL_THICKNESS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants'
import { clamp } from './math'
import type {
  GeneratedLevel,
  Point,
  TerrainShape,
  TerrainSpec,
} from './types'

type Random = () => number
type Range = readonly [number, number]
type RectBounds = {
  height: number
  width: number
  x: number
  y: number
}

type Platform = {
  fill: string
  height: number
  left: number
  leftTop: number
  right: number
  rightTop: number
}

type FinishGoal = {
  surfaceY: number
  x: number
}

type FinishLanding = {
  goal: FinishGoal
  platform: Platform
}

type Corridor = {
  endX: number
  endY: number
  halfHeight: number
  length: number
  path: Point[]
  startX: number
  startY: number
}

const BASE_START_PLATFORM: Platform = {
  fill: '#2c6470',
  height: 64,
  left: -70,
  leftTop: 606,
  right: 660,
  rightTop: 644,
}

const GROUND_FILLS = [
  '#2c6470',
  '#245761',
  '#31675a',
  '#2f5f68',
  '#2f6b61',
  '#275965',
  '#35655c',
]

const GROUND_STROKE = '#142f36'
const DEADLY_FILL = '#e14d42'
const DEADLY_STROKE = '#9b251f'
const FINISH_FILL = '#ffffff'
const FINISH_STROKE = '#1b2a2e'
const PLATFORM_HEIGHT = 60
const MIN_TRACK_TOP = 420
const MAX_TRACK_TOP = WORLD_HEIGHT - 230
const BOUNDARY_INSET = 46
const CORRIDOR_HALF_HEIGHT = 260
const CORRIDOR_START_BACKTRACK = 220
const CORRIDOR_END_PADDING = 320
const CORRIDOR_STEP_X: Range = [330, 620]
const CORRIDOR_RANDOM_WALK_Y = 240
const CORRIDOR_CANDIDATE_COUNT = 9
const CORRIDOR_UPWARD_SOFT_LIMIT = 46
const CORRIDOR_UPWARD_HARD_LIMIT = 150
const CORRIDOR_UPWARD_PENALTY = 3.7
const CORRIDOR_TARGET_PENALTY_Y = 210
const FINISH_RIGHT_MARGIN = 170
const FINISH_DISTANCE_X: Range = [
  3600,
  WORLD_WIDTH - START_X - FINISH_RIGHT_MARGIN,
]
const FINISH_SURFACE_Y: Range = [
  2180,
  WORLD_HEIGHT - CORRIDOR_HALF_HEIGHT - WALL_THICKNESS / 2 - BOUNDARY_INSET,
]
const MIN_FINISH_DROP_FROM_START = 1450
const FINAL_PLATFORM_WIDTH: Range = [740, 1080]
const FINAL_PLATFORM_RIGHT_RISE: Range = [-12, 28]
const FINAL_PLATFORM_FINISH_OFFSET: Range = [230, 840]
const FINAL_PLATFORM_TRAILING_MARGIN = 150
const FINAL_PLATFORM_RIGHT_MARGIN = 36
const SCATTER_PLATFORM_COUNT: Range = [5, 8]
const SCATTER_PLATFORM_WIDTH: Range = [250, 620]
const SCATTER_PLATFORM_HEIGHT: Range = [44, 68]
const SCATTER_PLATFORM_RIGHT_RISE: Range = [-72, 72]
const SCATTER_PLATFORM_VERTICAL_JITTER = 380
const SCATTER_PLATFORM_EDGE_MARGIN = 140
const SCATTER_PLATFORM_CLEARANCE_X = 70
const SCATTER_PLATFORM_CLEARANCE_Y = 150
const SCATTER_PLATFORM_ATTEMPTS = 80
const CORRIDOR_PLATFORM_MARGIN = 86
const CORRIDOR_OBJECT_MARGIN = 72
const DEADLY_OBJECT_COUNT: Range = [3, 6]
const DEADLY_OBJECT_HORIZONTAL_WIDTH: Range = [110, 320]
const DEADLY_OBJECT_VERTICAL_HEIGHT: Range = [110, 300]
const DEADLY_OBJECT_START_MARGIN = 520
const DEADLY_OBJECT_FINISH_MARGIN = 260
const DEADLY_OBJECT_ATTEMPTS = 60

export function generateLevel(random: Random = Math.random): GeneratedLevel {
  const startPlatform = createStartPlatform(random)
  const startSurfaceY = surfaceYAt(startPlatform, START_X)
  const finishLanding = createFinishLanding(startSurfaceY, random)
  const corridor = createCorridor(startPlatform, finishLanding, random)
  const scatteredPlatforms = createScatteredPlatforms(
    random,
    startPlatform,
    finishLanding.platform,
    corridor,
  )
  const platforms = [
    startPlatform,
    ...scatteredPlatforms,
    finishLanding.platform,
  ]
  const boundaryWalls = createBoundaryWalls(corridor)
  const terrain: TerrainSpec[] = [
    ...platforms.map(platformToSpec),
    ...boundaryWalls,
    ...createScatteredObjects(
      random,
      platforms,
      finishLanding.goal,
      corridor,
    ),
    {
      deadly: false,
      kind: 'finish',
      shape: {
        height: 220,
        type: 'rect',
        width: 52,
        x: finishLanding.goal.x,
        y: finishLanding.goal.surfaceY - 100,
      },
      style: {
        fill: FINISH_FILL,
        stroke: FINISH_STROKE,
      },
    },
  ]

  return {
    finishX: finishLanding.goal.x,
    startY: startSurfaceY - BALL_RADIUS - 24,
    terrain,
  }
}

function createStartPlatform(random: Random): Platform {
  const leftTop = BASE_START_PLATFORM.leftTop + randomInt(random, -30, 28)
  const rightTop = BASE_START_PLATFORM.rightTop + randomInt(random, -24, 36)

  return {
    ...BASE_START_PLATFORM,
    fill: pickGroundFill(random, 0),
    leftTop,
    right: BASE_START_PLATFORM.right + randomInt(random, -72, 78),
    rightTop,
  }
}

function createFinishLanding(
  startSurfaceY: number,
  random: Random,
): FinishLanding {
  const width = randomInt(
    random,
    FINAL_PLATFORM_WIDTH[0],
    FINAL_PLATFORM_WIDTH[1],
  )
  const finishOffset = randomInt(
    random,
    FINAL_PLATFORM_FINISH_OFFSET[0],
    Math.min(
      FINAL_PLATFORM_FINISH_OFFSET[1],
      width - FINAL_PLATFORM_TRAILING_MARGIN,
    ),
  )
  const finishX = randomInt(
    random,
    START_X + FINISH_DISTANCE_X[0],
    Math.min(
      START_X + FINISH_DISTANCE_X[1],
      WORLD_WIDTH -
        FINAL_PLATFORM_RIGHT_MARGIN -
        (width - finishOffset),
    ),
  )
  const rightRise = randomInt(
    random,
    FINAL_PLATFORM_RIGHT_RISE[0],
    FINAL_PLATFORM_RIGHT_RISE[1],
  )
  const finishProgress = finishOffset / width
  const minSlopeSurfaceY =
    MIN_TRACK_TOP +
    Math.max(
      rightRise * finishProgress,
      -rightRise * (1 - finishProgress),
      0,
    )
  const maxSlopeSurfaceY =
    MAX_TRACK_TOP -
    Math.max(
      -rightRise * finishProgress,
      rightRise * (1 - finishProgress),
      0,
    )
  const minSurfaceY = Math.max(
    FINISH_SURFACE_Y[0],
    startSurfaceY + MIN_FINISH_DROP_FROM_START,
    minSlopeSurfaceY,
  )
  const maxSurfaceY = Math.min(FINISH_SURFACE_Y[1], maxSlopeSurfaceY)
  const surfaceY = randomInt(
    random,
    Math.min(minSurfaceY, maxSurfaceY),
    maxSurfaceY,
  )
  const left = finishX - finishOffset
  const leftTop = surfaceY - rightRise * finishProgress

  return {
    goal: {
      surfaceY,
      x: finishX,
    },
    platform: {
      fill: pickGroundFill(random, 6),
      height: PLATFORM_HEIGHT,
      left,
      leftTop,
      right: left + width,
      rightTop: leftTop + rightRise,
    },
  }
}

function createScatteredPlatforms(
  random: Random,
  startPlatform: Platform,
  finalPlatform: Platform,
  corridor: Corridor,
): Platform[] {
  const platforms: Platform[] = []
  const placed = [startPlatform, finalPlatform]
  const count = randomInt(
    random,
    SCATTER_PLATFORM_COUNT[0],
    SCATTER_PLATFORM_COUNT[1],
  )
  const minLeft = startPlatform.right + SCATTER_PLATFORM_EDGE_MARGIN
  const maxRight = finalPlatform.left - SCATTER_PLATFORM_EDGE_MARGIN

  if (maxRight - minLeft < SCATTER_PLATFORM_WIDTH[0]) {
    return platforms
  }

  for (
    let attempt = 0;
    platforms.length < count && attempt < count * SCATTER_PLATFORM_ATTEMPTS;
    attempt += 1
  ) {
    const platform = createScatteredPlatform(
      random,
      minLeft,
      maxRight,
      corridor,
      platforms.length,
    )

    if (!isPlatformClear(platform, placed, corridor)) {
      continue
    }

    platforms.push(platform)
    placed.push(platform)
  }

  return platforms.sort((a, b) => a.left - b.left)
}

function createScatteredPlatform(
  random: Random,
  minLeft: number,
  maxRight: number,
  corridor: Corridor,
  fillIndex: number,
): Platform {
  const width = randomInt(
    random,
    SCATTER_PLATFORM_WIDTH[0],
    Math.min(SCATTER_PLATFORM_WIDTH[1], maxRight - minLeft),
  )
  const left = randomInt(random, minLeft, maxRight - width)
  const midX = left + width / 2
  const leftTop = clamp(
    corridorCenterYAt(corridor, midX) + randomInt(
      random,
      -SCATTER_PLATFORM_VERTICAL_JITTER,
      SCATTER_PLATFORM_VERTICAL_JITTER,
    ),
    MIN_TRACK_TOP + 70,
    MAX_TRACK_TOP - 90,
  )
  const rightTop = clamp(
    leftTop +
      randomInt(
        random,
        SCATTER_PLATFORM_RIGHT_RISE[0],
        SCATTER_PLATFORM_RIGHT_RISE[1],
      ),
    MIN_TRACK_TOP,
    MAX_TRACK_TOP,
  )

  return {
    fill: pickGroundFill(random, fillIndex + 1),
    height: randomInt(
      random,
      SCATTER_PLATFORM_HEIGHT[0],
      SCATTER_PLATFORM_HEIGHT[1],
    ),
    left,
    leftTop,
    right: left + width,
    rightTop,
  }
}

function isPlatformClear(
  candidate: Platform,
  platforms: Platform[],
  corridor: Corridor,
) {
  return (
    isPlatformInsideCorridor(candidate, corridor) &&
    platforms.every((platform) => {
      const horizontalNear =
        candidate.left < platform.right + SCATTER_PLATFORM_CLEARANCE_X &&
        candidate.right > platform.left - SCATTER_PLATFORM_CLEARANCE_X
      const verticalNear =
        Math.abs(platformMidY(candidate) - platformMidY(platform)) <
        SCATTER_PLATFORM_CLEARANCE_Y

      return !(horizontalNear && verticalNear)
    })
  )
}

function createCorridor(
  startPlatform: Platform,
  finishLanding: FinishLanding,
  random: Random,
): Corridor {
  const startSurfaceY = surfaceYAt(startPlatform, START_X)
  const routeStartX = START_X - CORRIDOR_START_BACKTRACK
  const endX = Math.min(
    WORLD_WIDTH,
    finishLanding.platform.right + CORRIDOR_END_PADDING,
  )
  const slope =
    (finishLanding.goal.surfaceY - startSurfaceY) /
    (finishLanding.goal.x - START_X)
  const startY = startSurfaceY + slope * (routeStartX - START_X)
  const endY =
    finishLanding.goal.surfaceY + slope * (endX - finishLanding.goal.x)
  const path = createCorridorPath(
    random,
    routeStartX,
    startY,
    finishLanding.goal.x,
    finishLanding.goal.surfaceY,
    endX,
    endY,
  )
  const finalPoint = path[path.length - 1]

  return {
    endX,
    endY: finalPoint.y,
    halfHeight: CORRIDOR_HALF_HEIGHT,
    length: pathLength(path),
    path,
    startX: routeStartX,
    startY,
  }
}

function createCorridorPath(
  random: Random,
  startX: number,
  startY: number,
  finishX: number,
  finishY: number,
  endX: number,
  endY: number,
) {
  const minY = CORRIDOR_HALF_HEIGHT + WALL_THICKNESS + BOUNDARY_INSET
  const maxY = WORLD_HEIGHT - CORRIDOR_HALF_HEIGHT - WALL_THICKNESS - BOUNDARY_INSET
  const path: Point[] = [{ x: startX, y: clamp(startY, minY, maxY) }]

  appendCorridorLeg(
    random,
    path,
    { x: finishX, y: clamp(finishY, minY, maxY) },
    minY,
    maxY,
  )
  appendCorridorLeg(
    random,
    path,
    { x: endX, y: clamp(endY, minY, maxY) },
    minY,
    maxY,
  )

  return path
}

function appendCorridorLeg(
  random: Random,
  path: Point[],
  target: Point,
  minY: number,
  maxY: number,
) {
  let current = path[path.length - 1]

  while (target.x - current.x > CORRIDOR_STEP_X[1]) {
    const remainingX = target.x - current.x
    const maxStep = Math.min(
      CORRIDOR_STEP_X[1],
      remainingX - CORRIDOR_STEP_X[0],
    )
    const minStep = Math.min(CORRIDOR_STEP_X[0], maxStep)
    const x = current.x + randomInt(random, minStep, maxStep)
    const next = chooseCorridorPoint(random, current, target, x, minY, maxY)

    path.push(next)
    current = next
  }

  if (
    path[path.length - 1].x !== target.x ||
    path[path.length - 1].y !== target.y
  ) {
    path.push(target)
  }
}

function chooseCorridorPoint(
  random: Random,
  current: Point,
  target: Point,
  x: number,
  minY: number,
  maxY: number,
) {
  const progress = clamp((x - current.x) / (target.x - current.x), 0, 1)
  const idealY = current.y + (target.y - current.y) * progress
  const candidateMinY = Math.max(minY, current.y - CORRIDOR_UPWARD_HARD_LIMIT)
  const candidateMaxY = Math.min(maxY, target.y + CORRIDOR_UPWARD_HARD_LIMIT)
  const candidates: Array<Point & { weight: number }> = [
    weightedCorridorPoint(
      current,
      target,
      x,
      clamp(idealY, candidateMinY, candidateMaxY),
      idealY,
    ),
  ]

  for (let index = 1; index < CORRIDOR_CANDIDATE_COUNT; index += 1) {
    const y = clamp(
      idealY +
        randomInt(
          random,
          -CORRIDOR_RANDOM_WALK_Y,
          CORRIDOR_RANDOM_WALK_Y,
        ),
      candidateMinY,
      candidateMaxY,
    )

    candidates.push(weightedCorridorPoint(current, target, x, y, idealY))
  }

  return pickWeightedPoint(random, candidates)
}

function weightedCorridorPoint(
  current: Point,
  target: Point,
  x: number,
  y: number,
  idealY: number,
) {
  const climb = Math.max(0, current.y - y)
  const upwardExcess = Math.max(0, climb - CORRIDOR_UPWARD_SOFT_LIMIT)
  const targetOvershoot = Math.max(
    0,
    y - target.y - CORRIDOR_UPWARD_SOFT_LIMIT,
  )
  const targetPenalty = Math.abs(y - idealY) / CORRIDOR_TARGET_PENALTY_Y
  const upwardPenalty =
    (upwardExcess / CORRIDOR_UPWARD_SOFT_LIMIT) *
    CORRIDOR_UPWARD_PENALTY
  const overshootPenalty =
    (targetOvershoot / CORRIDOR_UPWARD_SOFT_LIMIT) *
    CORRIDOR_UPWARD_PENALTY *
    0.65

  return {
    weight: Math.exp(-(targetPenalty + upwardPenalty + overshootPenalty)),
    x,
    y,
  }
}

function pickWeightedPoint(
  random: Random,
  candidates: Array<Point & { weight: number }>,
): Point {
  const totalWeight = candidates.reduce(
    (total, candidate) => total + candidate.weight,
    0,
  )
  let ticket = random() * totalWeight

  for (const candidate of candidates) {
    ticket -= candidate.weight

    if (ticket <= 0) {
      return { x: candidate.x, y: candidate.y }
    }
  }

  const fallback = candidates[candidates.length - 1]

  return { x: fallback.x, y: fallback.y }
}

function pathLength(path: Point[]) {
  let length = 0

  for (let index = 1; index < path.length; index += 1) {
    length += distanceBetween(path[index - 1], path[index])
  }

  return length
}

function offsetPath(path: Point[], offset: number) {
  return path.map((point, index) => {
    const normal = pathPointNormal(path, index)

    return {
      x: point.x + normal.x * offset,
      y: point.y + normal.y * offset,
    }
  })
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

function distanceBetween(from: Point, to: Point) {
  return Math.hypot(to.x - from.x, to.y - from.y)
}

function createBoundaryWalls(corridor: Corridor): TerrainSpec[] {
  return [
    createCorridorWallSide(corridor, -1),
    createCorridorWallSide(corridor, 1),
  ]
}

function createCorridorWallSide(
  corridor: Corridor,
  side: -1 | 1,
): TerrainSpec {
  return {
    deadly: false,
    kind: 'wall',
    shape: {
      points: offsetPath(corridor.path, side * corridor.halfHeight),
      thickness: WALL_THICKNESS,
      type: 'polyline',
    },
    style: {
      fill: DEADLY_FILL,
      stroke: DEADLY_STROKE,
    },
  }
}

function createScatteredObjects(
  random: Random,
  platforms: Platform[],
  finishGoal: FinishGoal,
  corridor: Corridor,
): TerrainSpec[] {
  const objects: TerrainSpec[] = []
  const count = randomInt(random, DEADLY_OBJECT_COUNT[0], DEADLY_OBJECT_COUNT[1])
  const minX = START_X + DEADLY_OBJECT_START_MARGIN
  const maxX = Math.max(minX, finishGoal.x - DEADLY_OBJECT_FINISH_MARGIN)

  for (
    let attempt = 0;
    objects.length < count && attempt < count * DEADLY_OBJECT_ATTEMPTS;
    attempt += 1
  ) {
    const object = createScatteredObject(random, minX, maxX, corridor)

    if (
      !isObjectClear(
        object,
        objects,
        platforms,
        finishGoal,
        corridor,
      )
    ) {
      continue
    }

    objects.push(object)
  }

  return objects
}

function createScatteredObject(
  random: Random,
  minX: number,
  maxX: number,
  corridor: Corridor,
): TerrainSpec {
  if (random() < 0.68) {
    const width = randomInt(
      random,
      DEADLY_OBJECT_HORIZONTAL_WIDTH[0],
      DEADLY_OBJECT_HORIZONTAL_WIDTH[1],
    )
    const height = WALL_THICKNESS
    const x = randomInt(random, minX + width / 2, maxX - width / 2)
    const y = randomObjectY(random, corridor, x, height)

    return {
      deadly: true,
      kind: 'object',
      shape: {
        height,
        type: 'rect',
        width,
        x,
        y,
      },
      style: {
        fill: DEADLY_FILL,
        spikes: 'up',
        stroke: DEADLY_STROKE,
      },
    }
  }

  const height = randomInt(
    random,
    DEADLY_OBJECT_VERTICAL_HEIGHT[0],
    DEADLY_OBJECT_VERTICAL_HEIGHT[1],
  )
  const x = randomInt(
    random,
    minX + WALL_THICKNESS / 2,
    maxX - WALL_THICKNESS / 2,
  )

  return {
    deadly: true,
    kind: 'object',
    shape: {
      height,
      type: 'rect',
      width: WALL_THICKNESS,
      x,
      y: randomObjectY(random, corridor, x, height),
    },
    style: {
      fill: DEADLY_FILL,
      spikes: random() < 0.5 ? 'left' : 'right',
      stroke: DEADLY_STROKE,
    },
  }
}

function randomObjectY(
  random: Random,
  corridor: Corridor,
  x: number,
  height: number,
) {
  const spread = Math.max(
    0,
    corridor.halfHeight - CORRIDOR_OBJECT_MARGIN - height / 2,
  )

  return corridorCenterYAt(corridor, x) + randomInt(random, -spread, spread)
}

function isObjectClear(
  candidate: TerrainSpec,
  objects: TerrainSpec[],
  platforms: Platform[],
  finishGoal: FinishGoal,
  corridor: Corridor,
) {
  const candidateBounds = shapeBounds(candidate.shape)

  if (
    Math.abs(candidateBounds.x - finishGoal.x) < DEADLY_OBJECT_FINISH_MARGIN &&
    Math.abs(candidateBounds.y - finishGoal.surfaceY) < 230
  ) {
    return false
  }

  return (
    isObjectInsideCorridor(candidate, corridor) &&
    objects.every(
      (object) => !rectsOverlap(candidateBounds, shapeBounds(object.shape), 80),
    ) &&
    platforms.every((platform) => !objectOverlapsPlatform(candidate, platform))
  )
}

function objectOverlapsPlatform(object: TerrainSpec, platform: Platform) {
  const objectBounds = shapeBounds(object.shape)
  const platformTop = Math.min(platform.leftTop, platform.rightTop) - 60
  const platformBottom =
    Math.max(platform.leftTop, platform.rightTop) + platform.height + 60
  const platformRect = {
    height: platformBottom - platformTop,
    width: platform.right - platform.left + 90,
    x: (platform.left + platform.right) / 2,
    y: (platformTop + platformBottom) / 2,
  }

  return rectsOverlap(objectBounds, platformRect, 0)
}

function isPlatformInsideCorridor(platform: Platform, corridor: Corridor) {
  const points = [
    { x: platform.left, y: platform.leftTop },
    { x: platform.right, y: platform.rightTop },
    { x: platform.left, y: platform.leftTop + platform.height },
    { x: platform.right, y: platform.rightTop + platform.height },
  ]

  return points.every((point) =>
    isPointInsideCorridor(point.x, point.y, corridor, CORRIDOR_PLATFORM_MARGIN),
  )
}

function isObjectInsideCorridor(object: TerrainSpec, corridor: Corridor) {
  const bounds = shapeBounds(object.shape)
  const halfWidth = bounds.width / 2
  const halfHeight = bounds.height / 2
  const points = [
    { x: bounds.x - halfWidth, y: bounds.y - halfHeight },
    { x: bounds.x + halfWidth, y: bounds.y - halfHeight },
    { x: bounds.x - halfWidth, y: bounds.y + halfHeight },
    { x: bounds.x + halfWidth, y: bounds.y + halfHeight },
  ]

  return points.every((point) =>
    isPointInsideCorridor(point.x, point.y, corridor, CORRIDOR_OBJECT_MARGIN),
  )
}

function isPointInsideCorridor(
  x: number,
  y: number,
  corridor: Corridor,
  margin: number,
) {
  if (x < corridor.startX || x > corridor.endX) {
    return false
  }

  const sample = nearestCorridorSample(corridor, x, y)

  return (
    sample.progress >= 0 &&
    sample.progress <= 1 &&
    Math.abs(sample.signedDistance) <= corridor.halfHeight - margin
  )
}

function corridorCenterYAt(corridor: Corridor, x: number) {
  const path = corridor.path

  if (x <= path[0].x) {
    return path[0].y
  }

  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]
    const to = path[index]

    if (x <= to.x) {
      const progress = clamp((x - from.x) / (to.x - from.x), 0, 1)

      return from.y + (to.y - from.y) * progress
    }
  }

  return path[path.length - 1].y
}

function shapeBounds(shape: TerrainShape): RectBounds {
  if (shape.type === 'rect') {
    return shape
  }

  if (shape.points.length === 0) {
    return {
      height: 0,
      width: 0,
      x: 0,
      y: 0,
    }
  }

  const halfThickness = shape.thickness / 2
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  shape.points.forEach((point) => {
    minX = Math.min(minX, point.x - halfThickness)
    minY = Math.min(minY, point.y - halfThickness)
    maxX = Math.max(maxX, point.x + halfThickness)
    maxY = Math.max(maxY, point.y + halfThickness)
  })

  return {
    height: maxY - minY,
    width: maxX - minX,
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  }
}

function nearestCorridorSample(corridor: Corridor, x: number, y: number) {
  let bestDistance = Number.POSITIVE_INFINITY
  let bestSignedDistance = 0
  let bestLengthAt = 0
  let traveled = 0

  for (let index = 1; index < corridor.path.length; index += 1) {
    const from = corridor.path[index - 1]
    const to = corridor.path[index]
    const dx = to.x - from.x
    const dy = to.y - from.y
    const segmentLength = Math.hypot(dx, dy)
    const segmentLengthSquared = segmentLength * segmentLength

    if (segmentLengthSquared === 0) {
      continue
    }

    const progress = clamp(
      ((x - from.x) * dx + (y - from.y) * dy) / segmentLengthSquared,
      0,
      1,
    )
    const nearestX = from.x + dx * progress
    const nearestY = from.y + dy * progress
    const distance = Math.hypot(x - nearestX, y - nearestY)

    if (distance < bestDistance) {
      const normalX = -dy / segmentLength
      const normalY = dx / segmentLength

      bestDistance = distance
      bestSignedDistance = (x - nearestX) * normalX + (y - nearestY) * normalY
      bestLengthAt = traveled + segmentLength * progress
    }

    traveled += segmentLength
  }

  return {
    progress: bestLengthAt / corridor.length,
    signedDistance: bestSignedDistance,
  }
}

function rectsOverlap(
  a: RectBounds,
  b: RectBounds,
  padding: number,
) {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width + padding * 2 &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height + padding * 2
  )
}

function platformMidY(platform: Platform) {
  return (platform.leftTop + platform.rightTop) / 2
}

function platformToSpec(platform: Platform): TerrainSpec {
  const run = platform.right - platform.left
  const rise = platform.rightTop - platform.leftTop
  const angle = Math.atan2(rise, run)
  const length = Math.hypot(run, rise)
  const surfaceMidX = (platform.left + platform.right) / 2
  const surfaceMidY = (platform.leftTop + platform.rightTop) / 2
  const halfHeight = platform.height / 2

  return {
    deadly: false,
    kind: 'object',
    shape: {
      angle,
      height: platform.height,
      type: 'rect',
      width: length,
      x: surfaceMidX - Math.sin(angle) * halfHeight,
      y: surfaceMidY + Math.cos(angle) * halfHeight,
    },
    style: {
      fill: platform.fill,
      stroke: GROUND_STROKE,
    },
  }
}

function surfaceYAt(platform: Platform, x: number) {
  const progress = clamp(
    (x - platform.left) / (platform.right - platform.left),
    0,
    1,
  )

  return platform.leftTop + (platform.rightTop - platform.leftTop) * progress
}

function pickGroundFill(random: Random, index: number) {
  const offset = randomInt(random, 0, GROUND_FILLS.length - 1)
  return GROUND_FILLS[(index + offset) % GROUND_FILLS.length]
}

function randomInt(random: Random, min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min
}
