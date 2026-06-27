import * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  FINISH_X,
  HAZARD_HEIGHT,
  START_X,
  WORLD_HEIGHT,
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

type PlatformBounds = {
  left: Range
  rightRise: Range
  top: Range
  width: Range
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
const HAZARD_DROP = 126

const PLATFORM_BOUNDS: PlatformBounds[] = [
  {
    left: [820, 930],
    rightRise: [12, 44],
    top: [620, 760],
    width: [430, 560],
  },
  {
    left: [1520, 1660],
    rightRise: [-6, 22],
    top: [560, 680],
    width: [420, 510],
  },
  {
    left: [2260, 2410],
    rightRise: [8, 42],
    top: [770, 910],
    width: [390, 470],
  },
  {
    left: [2920, 3070],
    rightRise: [10, 44],
    top: [760, 900],
    width: [400, 480],
  },
  {
    left: [3600, 3740],
    rightRise: [12, 48],
    top: [990, 1140],
    width: [340, 430],
  },
]

const FINAL_PLATFORM_BOUNDS: PlatformBounds = {
  left: [4300, 4460],
  rightRise: [8, 34],
  top: [1180, MAX_TRACK_TOP],
  width: [860, 1020],
}

export function generateLevel(random: Random = Math.random): GeneratedLevel {
  const startPlatform = createStartPlatform(random)
  const firstDrop = createPlatform(random, PLATFORM_BOUNDS[0], 1)
  const uphill = createPlatform(random, PLATFORM_BOUNDS[1], 2)
  const lowerChoice = createPlatform(random, PLATFORM_BOUNDS[2], 3)
  const upperChoice = createUpperRoutePlatform(lowerChoice, random)
  const rejoin = createPlatform(random, PLATFORM_BOUNDS[3], 4)
  const stepLanding = createPlatform(random, PLATFORM_BOUNDS[4], 5)
  const finalPlatform = createPlatform(random, FINAL_PLATFORM_BOUNDS, 6)
  const platforms = [
    startPlatform,
    firstDrop,
    uphill,
    lowerChoice,
    rejoin,
    stepLanding,
    finalPlatform,
  ]
  const terrain: TerrainSpec[] = [
    {
      fill: '#315962',
      height: 310,
      role: 'ground',
      stroke: GROUND_STROKE,
      width: 48,
      x: -18,
      y: 530,
    },
  ]

  terrain.push(...platforms.map(platformToSpec))
  terrain.push(platformToSpec(upperChoice))

  for (let index = 0; index < platforms.length - 1; index += 1) {
    terrain.push(createHazardSpec(platforms[index], platforms[index + 1]))
  }

  terrain.push(...createShaftHazards(stepLanding, finalPlatform, random))
  terrain.push({
    fill: FINISH_FILL,
    height: 220,
    role: 'finish',
    stroke: FINISH_STROKE,
    width: 52,
    x: FINISH_X,
    y: surfaceYAt(finalPlatform, FINISH_X) - 100,
  })

  return {
    finishX: FINISH_X,
    startY: surfaceYAt(platforms[0], START_X) - BALL_RADIUS - 24,
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

function createPlatform(
  random: Random,
  bounds: PlatformBounds,
  fillIndex: number,
) {
  const left = randomInt(random, bounds.left[0], bounds.left[1])
  const leftTop = clamp(
    randomInt(random, bounds.top[0], bounds.top[1]),
    MIN_TRACK_TOP,
    MAX_TRACK_TOP,
  )
  const width = randomInt(random, bounds.width[0], bounds.width[1])

  return {
    fill: pickGroundFill(random, fillIndex),
    height: PLATFORM_HEIGHT,
    left,
    leftTop,
    right: left + width,
    rightTop: clamp(
      leftTop +
        randomInt(random, bounds.rightRise[0], bounds.rightRise[1]),
      MIN_TRACK_TOP,
      MAX_TRACK_TOP,
    ),
  }
}

function createUpperRoutePlatform(base: Platform, random: Random): Platform {
  const leftTop = clamp(
    base.leftTop - randomInt(random, 150, 220),
    MIN_TRACK_TOP,
    Math.max(MIN_TRACK_TOP, base.leftTop - 86),
  )

  return {
    fill: pickGroundFill(random, 5),
    height: PLATFORM_HEIGHT - 6,
    left: base.left + randomInt(random, 24, 70),
    leftTop,
    right: base.right - randomInt(random, 36, 86),
    rightTop: clamp(
      leftTop + randomInt(random, -8, 18),
      MIN_TRACK_TOP,
      MAX_TRACK_TOP,
    ),
  }
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

function createHazardSpec(from: Platform, to: Platform): TerrainSpec {
  const gap = to.left - from.right
  const fromEdgeY = surfaceYAt(from, from.right)
  const toEdgeY = surfaceYAt(to, to.left)

  return {
    fill: HAZARD_FILL,
    height: HAZARD_HEIGHT,
    role: 'hazard',
    stroke: HAZARD_STROKE,
    width: Math.max(54, gap - 26),
    x: from.right + gap / 2,
    y: clamp(
      Math.max(fromEdgeY, toEdgeY) + HAZARD_DROP,
      HAZARD_HEIGHT / 2,
      WORLD_HEIGHT - HAZARD_HEIGHT / 2,
    ),
  }
}

function createShaftHazards(
  from: Platform,
  to: Platform,
  random: Random,
): TerrainSpec[] {
  const gap = to.left - from.right
  const fromEdgeY = surfaceYAt(from, from.right)
  const toEdgeY = surfaceYAt(to, to.left)
  const top = Math.min(fromEdgeY, toEdgeY) + 92
  const bottom = Math.max(fromEdgeY, toEdgeY) - 62
  const height = clamp(bottom - top, 150, 330)
  const centerY = top + height / 2
  const rightHeight = Math.max(96, height * 0.64)

  return [
    {
      fill: HAZARD_FILL,
      hazardDirection: 'right',
      height,
      role: 'hazard',
      stroke: HAZARD_STROKE,
      width: HAZARD_HEIGHT,
      x: from.right + gap * 0.22 + randomInt(random, -8, 10),
      y: centerY - 20,
    },
    {
      fill: HAZARD_FILL,
      hazardDirection: 'left',
      height: rightHeight,
      role: 'hazard',
      stroke: HAZARD_STROKE,
      width: HAZARD_HEIGHT,
      x: to.left + HAZARD_HEIGHT * 0.85 + randomInt(random, -6, 8),
      y: top - 34,
    },
  ]
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
