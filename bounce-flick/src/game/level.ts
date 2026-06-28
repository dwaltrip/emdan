import * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  HAZARD_HEIGHT,
  START_X,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants'
import { clamp } from './math'
import type {
  GeneratedLevel,
  TerrainPiece,
  TerrainSpec,
} from './types'

type Random = () => number
type Range = readonly [number, number]

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
  angle: number
  endX: number
  endY: number
  halfHeight: number
  length: number
  normalX: number
  normalY: number
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
const HAZARD_FILL = '#e14d42'
const HAZARD_STROKE = '#9b251f'
const FINISH_FILL = '#ffffff'
const FINISH_STROKE = '#1b2a2e'
const PLATFORM_HEIGHT = 60
const MIN_TRACK_TOP = 420
const MAX_TRACK_TOP = WORLD_HEIGHT - 230
const BOUNDARY_INSET = 46
const CORRIDOR_HALF_HEIGHT = 260
const CORRIDOR_START_BACKTRACK = 220
const CORRIDOR_END_PADDING = 320
const FINISH_RIGHT_MARGIN = 170
const FINISH_DISTANCE_X: Range = [
  3600,
  WORLD_WIDTH - START_X - FINISH_RIGHT_MARGIN,
]
const FINISH_SURFACE_Y: Range = [
  2180,
  WORLD_HEIGHT - CORRIDOR_HALF_HEIGHT - HAZARD_HEIGHT / 2 - BOUNDARY_INSET,
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
const CORRIDOR_HAZARD_MARGIN = 72
const HAZARD_COUNT: Range = [3, 6]
const HAZARD_HORIZONTAL_WIDTH: Range = [110, 320]
const HAZARD_VERTICAL_HEIGHT: Range = [110, 300]
const HAZARD_START_MARGIN = 520
const HAZARD_FINISH_MARGIN = 260
const HAZARD_ATTEMPTS = 60

export function generateLevel(random: Random = Math.random): GeneratedLevel {
  const startPlatform = createStartPlatform(random)
  const startSurfaceY = surfaceYAt(startPlatform, START_X)
  const finishLanding = createFinishLanding(startSurfaceY, random)
  const corridor = createCorridor(startPlatform, finishLanding)
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
  const boundaryHazards = createBoundaryHazards(corridor)
  const terrain: TerrainSpec[] = []

  terrain.push(...platforms.map(platformToSpec))
  terrain.push(...boundaryHazards)
  terrain.push(
    ...createScatteredHazards(
      random,
      platforms,
      finishLanding.goal,
      boundaryHazards,
      corridor,
    ),
  )
  terrain.push({
    fill: FINISH_FILL,
    height: 220,
    role: 'finish',
    stroke: FINISH_STROKE,
    width: 52,
    x: finishLanding.goal.x,
    y: surfaceYAt(finishLanding.platform, finishLanding.goal.x) - 100,
  })

  return {
    finishX: finishLanding.goal.x,
    startY: startSurfaceY - BALL_RADIUS - 24,
    terrain,
  }
}

export function createTerrain(engine: Matter.Engine, level: GeneratedLevel) {
  const terrain: TerrainPiece[] = []

  level.terrain.forEach((spec) => {
    const body = createTerrainBody(spec)

    terrain.push({
      body,
      fill: spec.fill,
      hazardDirection: spec.hazardDirection,
      role: spec.role,
      stroke: spec.stroke,
    })
    Matter.Composite.add(engine.world, body)
  })

  return terrain
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
  const descentProgress = clamp(
    (midX - minLeft) / (maxRight - minLeft),
    0,
    1,
  )
  const descentY =
    corridorCenterYAt(corridor, minLeft) +
    (corridorCenterYAt(corridor, maxRight) -
      corridorCenterYAt(corridor, minLeft)) *
      descentProgress
  const leftTop = clamp(
    descentY + randomInt(
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
  const dx = endX - routeStartX
  const dy = endY - startY
  const length = Math.hypot(dx, dy)

  return {
    angle: Math.atan2(dy, dx),
    endX,
    endY,
    halfHeight: CORRIDOR_HALF_HEIGHT,
    length,
    normalX: -dy / length,
    normalY: dx / length,
    startX: routeStartX,
    startY,
  }
}

function createBoundaryHazards(corridor: Corridor): TerrainSpec[] {
  return [
    createCorridorSide(corridor, -1),
    createCorridorSide(corridor, 1),
    createCorridorCap(corridor, corridor.startX, corridor.startY),
    createCorridorCap(corridor, corridor.endX, corridor.endY),
  ]
}

function createCorridorSide(
  corridor: Corridor,
  side: -1 | 1,
): TerrainSpec {
  const midX = (corridor.startX + corridor.endX) / 2
  const midY = (corridor.startY + corridor.endY) / 2
  const offset = side * corridor.halfHeight

  return {
    fill: HAZARD_FILL,
    hazardDirection: 'wall',
    height: HAZARD_HEIGHT,
    role: 'hazard',
    stroke: HAZARD_STROKE,
    width: corridor.length,
    x: midX + corridor.normalX * offset,
    y: midY + corridor.normalY * offset,
    angle: corridor.angle,
  }
}

function createCorridorCap(
  corridor: Corridor,
  x: number,
  y: number,
): TerrainSpec {
  return {
    fill: HAZARD_FILL,
    hazardDirection: 'wall',
    height: corridor.halfHeight * 2 + HAZARD_HEIGHT,
    role: 'hazard',
    stroke: HAZARD_STROKE,
    width: HAZARD_HEIGHT,
    x,
    y,
    angle: corridor.angle,
  }
}

function createScatteredHazards(
  random: Random,
  platforms: Platform[],
  finishGoal: FinishGoal,
  boundaryHazards: TerrainSpec[],
  corridor: Corridor,
): TerrainSpec[] {
  const hazards: TerrainSpec[] = []
  const count = randomInt(random, HAZARD_COUNT[0], HAZARD_COUNT[1])
  const minX = START_X + HAZARD_START_MARGIN
  const maxX = Math.max(minX, finishGoal.x - HAZARD_FINISH_MARGIN)

  for (
    let attempt = 0;
    hazards.length < count && attempt < count * HAZARD_ATTEMPTS;
    attempt += 1
  ) {
    const hazard = createScatteredHazard(random, minX, maxX, corridor)

    if (
      !isHazardClear(
        hazard,
        hazards,
        boundaryHazards,
        platforms,
        finishGoal,
        corridor,
      )
    ) {
      continue
    }

    hazards.push(hazard)
  }

  return hazards
}

function createScatteredHazard(
  random: Random,
  minX: number,
  maxX: number,
  corridor: Corridor,
): TerrainSpec {
  if (random() < 0.68) {
    const width = randomInt(
      random,
      HAZARD_HORIZONTAL_WIDTH[0],
      HAZARD_HORIZONTAL_WIDTH[1],
    )
    const height = HAZARD_HEIGHT
    const x = randomInt(random, minX + width / 2, maxX - width / 2)
    const y = randomHazardY(random, corridor, x, height)

    return {
      fill: HAZARD_FILL,
      height,
      role: 'hazard',
      stroke: HAZARD_STROKE,
      width,
      x,
      y,
    }
  }

  const height = randomInt(
    random,
    HAZARD_VERTICAL_HEIGHT[0],
    HAZARD_VERTICAL_HEIGHT[1],
  )
  const x = randomInt(
    random,
    minX + HAZARD_HEIGHT / 2,
    maxX - HAZARD_HEIGHT / 2,
  )

  return {
    fill: HAZARD_FILL,
    hazardDirection: random() < 0.5 ? 'left' : 'right',
    height,
    role: 'hazard',
    stroke: HAZARD_STROKE,
    width: HAZARD_HEIGHT,
    x,
    y: randomHazardY(random, corridor, x, height),
  }
}

function randomHazardY(
  random: Random,
  corridor: Corridor,
  x: number,
  height: number,
) {
  const spread = Math.max(
    0,
    corridor.halfHeight - CORRIDOR_HAZARD_MARGIN - height / 2,
  )

  return corridorCenterYAt(corridor, x) + randomInt(random, -spread, spread)
}

function isHazardClear(
  candidate: TerrainSpec,
  hazards: TerrainSpec[],
  boundaryHazards: TerrainSpec[],
  platforms: Platform[],
  finishGoal: FinishGoal,
  corridor: Corridor,
) {
  if (
    Math.abs(candidate.x - finishGoal.x) < HAZARD_FINISH_MARGIN &&
    Math.abs(candidate.y - finishGoal.surfaceY) < 230
  ) {
    return false
  }

  return (
    isHazardInsideCorridor(candidate, corridor) &&
    hazards.every((hazard) => !rectsOverlap(candidate, hazard, 80)) &&
    boundaryHazards.every(
      (hazard) => !rectsOverlap(candidate, hazard, BOUNDARY_INSET),
    ) &&
    platforms.every((platform) => !hazardOverlapsPlatform(candidate, platform))
  )
}

function hazardOverlapsPlatform(hazard: TerrainSpec, platform: Platform) {
  const platformTop = Math.min(platform.leftTop, platform.rightTop) - 60
  const platformBottom =
    Math.max(platform.leftTop, platform.rightTop) + platform.height + 60
  const platformRect = {
    height: platformBottom - platformTop,
    width: platform.right - platform.left + 90,
    x: (platform.left + platform.right) / 2,
    y: (platformTop + platformBottom) / 2,
  }

  return rectsOverlap(hazard, platformRect, 0)
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

function isHazardInsideCorridor(hazard: TerrainSpec, corridor: Corridor) {
  const halfWidth = hazard.width / 2
  const halfHeight = hazard.height / 2
  const points = [
    { x: hazard.x - halfWidth, y: hazard.y - halfHeight },
    { x: hazard.x + halfWidth, y: hazard.y - halfHeight },
    { x: hazard.x - halfWidth, y: hazard.y + halfHeight },
    { x: hazard.x + halfWidth, y: hazard.y + halfHeight },
  ]

  return points.every((point) =>
    isPointInsideCorridor(point.x, point.y, corridor, CORRIDOR_HAZARD_MARGIN),
  )
}

function isPointInsideCorridor(
  x: number,
  y: number,
  corridor: Corridor,
  margin: number,
) {
  return (
    corridorProgressAt(corridor, x, y) >= 0 &&
    corridorProgressAt(corridor, x, y) <= 1 &&
    Math.abs(corridorSignedDistanceAt(corridor, x, y)) <=
      corridor.halfHeight - margin
  )
}

function corridorCenterYAt(corridor: Corridor, x: number) {
  const progress = clamp(
    (x - corridor.startX) / (corridor.endX - corridor.startX),
    0,
    1,
  )

  return corridor.startY + (corridor.endY - corridor.startY) * progress
}

function corridorProgressAt(corridor: Corridor, x: number, y: number) {
  const dx = x - corridor.startX
  const dy = y - corridor.startY

  return (
    (dx * (corridor.endX - corridor.startX) +
      dy * (corridor.endY - corridor.startY)) /
    (corridor.length * corridor.length)
  )
}

function corridorSignedDistanceAt(corridor: Corridor, x: number, y: number) {
  return (
    (x - corridor.startX) * corridor.normalX +
    (y - corridor.startY) * corridor.normalY
  )
}

function rectsOverlap(
  a: Pick<TerrainSpec, 'height' | 'width' | 'x' | 'y'>,
  b: Pick<TerrainSpec, 'height' | 'width' | 'x' | 'y'>,
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
    angle,
    fill: platform.fill,
    height: platform.height,
    role: 'ground',
    stroke: GROUND_STROKE,
    width: length,
    x: surfaceMidX - Math.sin(angle) * halfHeight,
    y: surfaceMidY + Math.cos(angle) * halfHeight,
  }
}

function createTerrainBody(spec: TerrainSpec) {
  if (spec.role === 'hazard' || spec.role === 'finish') {
    return Matter.Bodies.rectangle(spec.x, spec.y, spec.width, spec.height, {
      angle: spec.angle ?? 0,
      isSensor: true,
      isStatic: true,
      label: spec.role,
    })
  }

  return Matter.Bodies.rectangle(spec.x, spec.y, spec.width, spec.height, {
    angle: spec.angle ?? 0,
    chamfer: { radius: 12 },
    friction: 0.92,
    isStatic: true,
    label: 'ground',
    restitution: 0.03,
  })
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
