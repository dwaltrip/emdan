import {
  BALL_RADIUS,
  START_X,
  WALL_THICKNESS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants'
import {
  offsetPolylineSegments,
  offsetPathByVertexNormal,
  pathLength,
  segmentXStops,
  segmentsYRangeOverSpan,
} from './geometry'
import { clamp } from './math'
import type { Segment } from './geometry'
import type {
  GeneratedLevel,
  Point,
  SpikeDirection,
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

type Corridor = {
  endX: number
  faces: {
    ceiling: Segment[]
    floor: Segment[]
  }
  halfHeight: number
  length: number
  path: Point[]
  startX: number
  walls: {
    ceiling: Point[]
    floor: Point[]
  }
}

type PlatformFitRange = {
  fits: boolean
  maxSurfaceY: number
  minSurfaceY: number
}

const BALL_HEIGHT = BALL_RADIUS * 2
// Minimum headroom above the start platform: enough for the ball.
// The 1.5 factor gives 50% margin (gameplay "feel" design decision).
const EDGE_CEILING_BUFFER = BALL_HEIGHT * 1.5

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

const MIN_TRACK_TOP = 420
const MAX_TRACK_TOP = WORLD_HEIGHT - 230
const BOUNDARY_INSET = 46
const CORRIDOR_HALF_HEIGHT = 320
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
const START_POINT_Y: Range = [560, 640]
const START_PLATFORM_WIDTH: Range = [680, 760]
const START_PLATFORM_LEFT_INSET = 10

// Offsets from corridor centerline for the start and finish platform surfaces.
// Tune this to place the platforms higher or lower in the channel.
const START_SURFACE_CENTERLINE_OFFSET: Range = [40, 140]
const FINISH_SURFACE_CENTERLINE_OFFSET: Range = [40, 140]

const FINISH_DROP_PLANNING_BUFFER = FINISH_SURFACE_CENTERLINE_OFFSET[1]
const FINISH_POST_HEIGHT = 220
const FINISH_TOP_BUFFER = FINISH_POST_HEIGHT + 20
const FINAL_PLATFORM_WIDTH: Range = [740, 1080]
// Offset for finish line from final platform left edge.
const FINISH_LINE_OFFSET: Range = [230, 840]
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
  const startPlan = planStartPlatform(random)
  const finishPlan = planFinishPlatform(random, startPlan.y)
  const corridor = createCorridor(
    startPlan,
    finishPlan,
    finishPlan.left + finishPlan.width,
    random,
  )

  const startPlatform = createCorridorPlatform(random, corridor, {
    anchorX: startPlan.x,
    fillIndex: 0,
    left: startPlan.left,
    topBuffer: EDGE_CEILING_BUFFER,
    width: startPlan.width,
    desiredOffsetY: randomInRange(random, START_SURFACE_CENTERLINE_OFFSET),
  })
  const startSurfaceY = surfaceYAt(startPlatform, startPlan.x)
  const finishPlatform = createCorridorPlatform(random, corridor, {
    anchorX: finishPlan.x,
    fillIndex: 6,
    left: finishPlan.left,
    minSurfaceY: startSurfaceY + MIN_FINISH_DROP_FROM_START,
    topBuffer: FINISH_TOP_BUFFER,
    width: finishPlan.width,
    desiredOffsetY: randomInRange(random, FINISH_SURFACE_CENTERLINE_OFFSET),
  })

  const finishGoal: FinishGoal = {
    surfaceY: surfaceYAt(finishPlatform, finishPlan.x),
    x: finishPlan.x,
  }
  const scatteredPlatforms = createScatteredPlatforms(
    random,
    startPlatform,
    finishPlatform,
    corridor,
  )
  const platforms = [startPlatform, ...scatteredPlatforms, finishPlatform]

  const terrain: TerrainSpec[] = [
    ...platforms.map(platformToSpec),
    createCorridorWall(corridor.walls.ceiling),
    createCorridorWall(corridor.walls.floor),
    ...createScatteredHazards(random, platforms, finishGoal, corridor),
    finishMarkerSpec(finishGoal),
  ]

  return {
    finishPlatformIndex: platforms.length - 1,
    finishX: finishGoal.x,
    startPlatformIndex: 0,
    startY: startSurfaceY - BALL_RADIUS - 24,
    terrain,
  }
}

// Start and finish share one plan shape: the route target (x, y) the corridor
// aims at, plus the platform's desired horizontal extent (left, width).
type PlatformPlan = { left: number; width: number; x: number; y: number }

function planStartPlatform(random: Random): PlatformPlan {
  const y = randomInRange(random, START_POINT_Y)
  const width = randomInRange(random, START_PLATFORM_WIDTH)

  return {
    left: START_X - CORRIDOR_START_BACKTRACK + START_PLATFORM_LEFT_INSET,
    width,
    x: START_X,
    y,
  }
}

function planFinishPlatform(random: Random, startTargetY: number): PlatformPlan {
  const width = randomInRange(random, FINAL_PLATFORM_WIDTH)
  const finishOffset = randomInt(
    random,
    FINISH_LINE_OFFSET[0],
    Math.min(FINISH_LINE_OFFSET[1], width - FINAL_PLATFORM_TRAILING_MARGIN),
  )
  const finishX = randomInt(
    random,
    START_X + FINISH_DISTANCE_X[0],
    Math.min(
      START_X + FINISH_DISTANCE_X[1],
      WORLD_WIDTH - FINAL_PLATFORM_RIGHT_MARGIN - (width - finishOffset),
    ),
  )
  // The finish platform Y-value must be:
  //    - At least `MIN_FINISH_DROP_FROM_START` distance from starting platform
  //    - Within the `FINISH_SURFACE_Y` range (game design heuristic)
  //    - Within the corridor "track": [MIN_TRACK_TOP, MAX_TRACK_TOP]
  const minTargetY = Math.max(
    FINISH_SURFACE_Y[0],
    startTargetY + MIN_FINISH_DROP_FROM_START + FINISH_DROP_PLANNING_BUFFER,
    MIN_TRACK_TOP,
  )
  const maxTargetY = Math.min(FINISH_SURFACE_Y[1], MAX_TRACK_TOP)

  return {
    left: finishX - finishOffset,
    width,
    x: finishX,
    y: randomInt(random, Math.min(minTargetY, maxTargetY), maxTargetY),
  }
}

// Build a flat platform inside an already-generated corridor. The platform is
// trimmed (keeping `anchorX` covered) until it fits the actual corridor wall
// face, with sufficient headroom above for the ball to pass.
function createCorridorPlatform(
  random: Random,
  corridor: Corridor,
  opts: {
    anchorX: number
    fillIndex: number
    left: number
    minSurfaceY?: number
    topBuffer: number
    width: number,
    // Desired distance from corridor centerline. Not guaranteed to get.
    desiredOffsetY?: number,
  },
): Platform {
  const { anchorX, fillIndex, left: desiredLeft, minSurfaceY, topBuffer, width } =
    opts
  const desiredOffsetY = opts.desiredOffsetY ?? 0
  const height = randomInRange(random, SCATTER_PLATFORM_HEIGHT)

  const { left, right } = flatSpanAroundAnchor(
    anchorX,
    corridorFaceXStops(corridor, anchorX, desiredLeft),
    corridorFaceXStops(corridor, anchorX, desiredLeft + width),
    (candidateLeft, candidateRight) => {
      const fit = platformFitRange(
        corridor,
        candidateLeft,
        candidateRight,
        height,
        topBuffer,
      )

      return (
        fit?.fits === true &&
        (minSurfaceY === undefined || minSurfaceY <= fit.maxSurfaceY)
      )
    },
  )

  // Using the given `start` and `finish` anchors from `generateLevel`, we found
  // that every level has sufficient space for the flat platforms, as desired.
  // Empirically tested in random sweep of 5,000 levels.
  // `ceilingClearY`: Y-surface closest to ceiling with the required headroom.
  // `floorClearY`: lowest Y-value where the platform doesn't touch the floor.
  const centerSurfaceY = corridorCenterYAt(corridor, anchorX)
  const fit = platformFitRange(corridor, left, right, height, topBuffer)
  const ceilingClearY = fit?.minSurfaceY ?? centerSurfaceY
  const floorClearY = Math.max(ceilingClearY, fit?.maxSurfaceY ?? centerSurfaceY)

  if (!fit?.fits) {
    console.warn(
      `[level] platform near x=${Math.round(anchorX)} has no flat fit over ` +
        `width ${Math.round(right - left)}; pinning to the ceiling buffer.`,
    )
  }
  if (minSurfaceY !== undefined && minSurfaceY > floorClearY) {
    console.warn(
      `[level] platform near x=${Math.round(anchorX)} can't satisfy minimum ` +
        `surface y=${Math.round(minSurfaceY)}; lowest safe surface is ` +
        `${Math.round(floorClearY)}.`,
    )
  }

  const targetY = centerSurfaceY + desiredOffsetY
  // Aim for target Y-value. Bounded by the ceiling clearance, floor clearance,
  // and the requested minimum given by the caller.
  // When the requested minimum can't be met, we clamp to the floor clearance.
  const surfaceY = clamp(
    targetY,
    Math.max(ceilingClearY, minSurfaceY ?? Number.NEGATIVE_INFINITY),
    floorClearY,
  )

  return {
    fill: pickGroundFill(random, fillIndex),
    height,
    left,
    leftTop: surfaceY,
    right,
    rightTop: surfaceY,
  }
}

// Returns widest flat span around anchorX that satisfies `fitsSpan`, bounded by
// the final stop on each side. The edges grow outward through wall-vertex stops,
// always taking the nearer next stop so growth stays centered on the anchor.
// If widening to a stop fails, extending farther in that direction will obviously
// fail as well. At that point, bisect between the last fit and the failed stop,
// then stop growing that side.
function flatSpanAroundAnchor(
  anchorX: number,
  stopsLeft: number[],
  stopsRight: number[],
  fitsSpan: (left: number, right: number) => boolean,
): { left: number; right: number } {
  const left = growEdge(anchorX, stopsLeft, (edge) => fitsSpan(edge, anchorX))
  const right = growEdge(anchorX, stopsRight, (edge) => fitsSpan(left, edge))

  return { left, right }
}

// Push one edge outward through its stops (ordered anchor-outward), keeping the
// farthest that fits. When a stop overshoots, bisect the gap to it for the exact
// farthest fitting point.
function growEdge(
  anchorX: number,
  stops: number[],
  edgeFits: (edge: number) => boolean,
): number {
  let edge = anchorX

  for (const stop of stops) {
    if (edgeFits(stop)) {
      edge = stop
    } else {
      return farthestFittingEdge(edge, stop, edgeFits)
    }
  }

  return edge
}

// Binary search through [fromX, toX] for the farthest point that still fits.
// `fromX` fits (edgeFits returns true), but `toX` does not.
// Return the point closest to `toX` that still passes the predicate.
function farthestFittingEdge(
  fromX: number,
  toX: number,
  edgeFits: (edge: number) => boolean,
): number {
  let fitT = 0
  let failT = 1

  for (let step = 0; step < 28; step += 1) {
    const midT = (fitT + failT) / 2
    if (edgeFits(fromX + (toX - fromX) * midT)) fitT = midT
    else failT = midT
  }

  return fromX + (toX - fromX) * fitT
}

// Wall-face vertex x's between the anchor and the target edge, ordered from the
// anchor outward, with the target edge itself as the final stop. segmentXStops
// already returns the interior vertices deduped and ordered, so we only append
// the target.
function corridorFaceXStops(
  corridor: Corridor,
  fromX: number,
  toX: number,
): number[] {
  const stops = segmentXStops(
    [...corridor.faces.ceiling, ...corridor.faces.floor],
    fromX,
    toX,
  )

  return [...stops, toX]
}

function platformFitRange(
  corridor: Corridor,
  left: number,
  right: number,
  height: number,
  topBuffer: number,
): PlatformFitRange | null {
  const ceilingRange = segmentsYRangeOverSpan(corridor.faces.ceiling, left, right)
  const floorRange = segmentsYRangeOverSpan(corridor.faces.floor, left, right)

  if (!ceilingRange || !floorRange) {
    return null
  }

  // Highest surface that clears the ceiling buffer, and lowest that keeps the body
  // off the floor; the platform fits flat when the former is at or above the latter.
  const minSurfaceY = ceilingRange.maxY + topBuffer
  const maxSurfaceY = floorRange.minY - height

  return {
    fits: minSurfaceY <= maxSurfaceY,
    maxSurfaceY,
    minSurfaceY,
  }
}

function finishMarkerSpec(goal: FinishGoal): TerrainSpec {
  return {
    deadly: false,
    kind: 'finish',
    shape: {
      height: FINISH_POST_HEIGHT,
      type: 'rect',
      width: 52,
      x: goal.x,
      y: goal.surfaceY - 100,
    },
    style: {
      fill: FINISH_FILL,
      stroke: FINISH_STROKE,
    },
  }
}

function createScatteredPlatforms(
  random: Random,
  startPlatform: Platform,
  finishPlatform: Platform,
  corridor: Corridor,
): Platform[] {
  const platforms: Platform[] = []
  const placed = [startPlatform, finishPlatform]
  const count = randomInRange(random, SCATTER_PLATFORM_COUNT)
  const minLeft = startPlatform.right + SCATTER_PLATFORM_EDGE_MARGIN
  const maxRight = finishPlatform.left - SCATTER_PLATFORM_EDGE_MARGIN

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
    leftTop + randomInRange(random, SCATTER_PLATFORM_RIGHT_RISE),
    MIN_TRACK_TOP,
    MAX_TRACK_TOP,
  )

  return {
    fill: pickGroundFill(random, fillIndex + 1),
    height: randomInRange(random, SCATTER_PLATFORM_HEIGHT),
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
  startPoint: Point,
  finishPoint: Point,
  finishRight: number,
  random: Random,
): Corridor {
  const routeStartX = startPoint.x - CORRIDOR_START_BACKTRACK
  const endX = Math.min(WORLD_WIDTH, finishRight + CORRIDOR_END_PADDING)
  const slope =
    (finishPoint.y - startPoint.y) / (finishPoint.x - startPoint.x)
  const startY = startPoint.y + slope * (routeStartX - startPoint.x)
  const endY = finishPoint.y + slope * (endX - finishPoint.x)
  const path = createCorridorPath(
    random,
    routeStartX,
    startY,
    finishPoint.x,
    finishPoint.y,
    endX,
    endY,
  )
  const ceilingWall = offsetPathByVertexNormal(path, -CORRIDOR_HALF_HEIGHT)
  const floorWall = offsetPathByVertexNormal(path, CORRIDOR_HALF_HEIGHT)

  return {
    endX,
    faces: {
      ceiling: offsetPolylineSegments(ceilingWall, WALL_THICKNESS / 2),
      floor: offsetPolylineSegments(floorWall, -WALL_THICKNESS / 2),
    },
    halfHeight: CORRIDOR_HALF_HEIGHT,
    length: pathLength(path),
    path,
    startX: routeStartX,
    walls: {
      ceiling: ceilingWall,
      floor: floorWall,
    },
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

function createCorridorWall(points: Point[]): TerrainSpec {
  return {
    deadly: false,
    kind: 'wall',
    shape: {
      points,
      thickness: WALL_THICKNESS,
      type: 'polyline',
    },
    style: {
      fill: DEADLY_FILL,
      stroke: DEADLY_STROKE,
    },
  }
}

function createScatteredHazards(
  random: Random,
  platforms: Platform[],
  finishGoal: FinishGoal,
  corridor: Corridor,
): TerrainSpec[] {
  const objects: TerrainSpec[] = []
  const count = randomInRange(random, DEADLY_OBJECT_COUNT)
  const minX = START_X + DEADLY_OBJECT_START_MARGIN
  const maxX = Math.max(minX, finishGoal.x - DEADLY_OBJECT_FINISH_MARGIN)

  for (
    let attempt = 0;
    objects.length < count && attempt < count * DEADLY_OBJECT_ATTEMPTS;
    attempt += 1
  ) {
    const object = createScatteredHazard(random, minX, maxX, corridor)

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

function createScatteredHazard(
  random: Random,
  minX: number,
  maxX: number,
  corridor: Corridor,
): TerrainSpec {
  // Most hazards are a wide floor strip of up-spikes; the rest are tall side spikes.
  if (random() < 0.68) {
    const width = randomInRange(random, DEADLY_OBJECT_HORIZONTAL_WIDTH)
    const x = randomInt(random, minX + width / 2, maxX - width / 2)

    return deadlyRect(
      x,
      randomObjectY(random, corridor, x, WALL_THICKNESS),
      width,
      WALL_THICKNESS,
      'up',
    )
  }

  const height = randomInRange(random, DEADLY_OBJECT_VERTICAL_HEIGHT)
  const x = randomInt(random, minX + WALL_THICKNESS / 2, maxX - WALL_THICKNESS / 2)
  const y = randomObjectY(random, corridor, x, height)

  return deadlyRect(x, y, WALL_THICKNESS, height, random() < 0.5 ? 'left' : 'right')
}

function deadlyRect(
  x: number,
  y: number,
  width: number,
  height: number,
  spikes: SpikeDirection,
): TerrainSpec {
  return {
    deadly: true,
    kind: 'object',
    shape: { height, type: 'rect', width, x, y },
    style: { fill: DEADLY_FILL, spikes, stroke: DEADLY_STROKE },
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
    isPointInsideCorridor(point, corridor, CORRIDOR_PLATFORM_MARGIN),
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
    isPointInsideCorridor(point, corridor, CORRIDOR_OBJECT_MARGIN),
  )
}

function isPointInsideCorridor(point: Point, corridor: Corridor, margin: number) {
  if (point.x < corridor.startX || point.x > corridor.endX) {
    return false
  }

  const sample = nearestCorridorSample(corridor, point.x, point.y)

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

function randomInRange(random: Random, [min, max]: Range): number {
  return randomInt(random, min, max)
}
