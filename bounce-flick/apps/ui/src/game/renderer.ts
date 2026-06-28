import type * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  INK_THICKNESS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants'
import { clamp } from './math'
import { addInkSegment, clampDrawingPoint } from './physics'
import type {
  InkSegment,
  PolylineShape,
  Runtime,
  SpikeDirection,
  TerrainStyle,
} from './types'

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  runtime: Runtime,
) {
  const bounds = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(320, bounds.width)
  const height = Math.max(420, bounds.height)

  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  runtime.viewportWidth = width
  runtime.viewportHeight = height
}

export function renderScene(
  context: CanvasRenderingContext2D,
  runtime: Runtime,
) {
  updateCamera(runtime)
  context.clearRect(0, 0, runtime.viewportWidth, runtime.viewportHeight)
  drawBackdrop(
    context,
    runtime.cameraX,
    runtime.cameraY,
    runtime.viewportWidth,
    runtime.viewportHeight,
  )

  context.save()
  context.translate(-runtime.cameraX, -runtime.cameraY)

  const viewLeft = runtime.cameraX - 160
  const viewRight = runtime.cameraX + runtime.viewportWidth + 160

  runtime.terrain.forEach((piece) => {
    if (piece.bounds.max.x < viewLeft || piece.bounds.min.x > viewRight) {
      return
    }

    if (piece.kind === 'finish') {
      drawFinishGate(context, piece.bodies[0])
      return
    }

    if (piece.shape.type === 'polyline') {
      drawPolyline(context, piece.shape, piece.style)
      return
    }

    if (piece.style.spikes) {
      drawSpikes(
        context,
        piece.bodies[0],
        piece.style.fill,
        piece.style.stroke,
        piece.style.spikes,
      )
      return
    }

    piece.bodies.forEach((body) => {
      drawBody(context, body, piece.style.fill, piece.style.stroke)
    })
  })

  runtime.inkSegments.forEach((segment) => {
    const minX = Math.min(segment.from.x, segment.to.x)
    const maxX = Math.max(segment.from.x, segment.to.x)
    if (maxX >= viewLeft && minX <= viewRight) {
      drawInkSegment(context, segment)
    }
  })

  drawBall(context, runtime.ball)
  context.restore()

  if (runtime.phase !== 'running') {
    context.fillStyle = 'rgba(247, 248, 251, 0.28)'
    context.fillRect(0, 0, runtime.viewportWidth, runtime.viewportHeight)
  }
}

function updateCamera(runtime: Runtime) {
  const previousCameraX = runtime.cameraX
  const previousCameraY = runtime.cameraY
  const maxCameraX = Math.max(0, WORLD_WIDTH - runtime.viewportWidth)
  const targetX = clamp(
    runtime.ball.position.x - runtime.viewportWidth * 0.34,
    0,
    maxCameraX,
  )
  const maxCameraY = Math.max(0, WORLD_HEIGHT - runtime.viewportHeight)
  const targetY = clamp(
    runtime.ball.position.y - runtime.viewportHeight * 0.44,
    0,
    maxCameraY,
  )

  runtime.cameraX += (targetX - runtime.cameraX) * 0.09
  runtime.cameraY += (targetY - runtime.cameraY) * 0.11

  dragActivePointer(runtime, previousCameraX, previousCameraY)
}

function dragActivePointer(
  runtime: Runtime,
  previousCameraX: number,
  previousCameraY: number,
) {
  if (
    runtime.pointerId === null ||
    !runtime.lastPointer ||
    !runtime.pointerScreen ||
    (runtime.cameraX === previousCameraX && runtime.cameraY === previousCameraY)
  ) {
    return
  }

  const target = clampDrawingPoint({
    x: runtime.pointerScreen.x + runtime.cameraX,
    y: runtime.pointerScreen.y + runtime.cameraY,
  })
  runtime.lastPointer = addInkSegment(runtime, runtime.lastPointer, target)
}

function drawBody(
  context: CanvasRenderingContext2D,
  body: Matter.Body,
  fill: string,
  stroke: string,
) {
  context.beginPath()
  body.vertices.forEach((vertex, index) => {
    if (index === 0) {
      context.moveTo(vertex.x, vertex.y)
      return
    }

    context.lineTo(vertex.x, vertex.y)
  })
  context.closePath()
  context.fillStyle = fill
  context.fill()
  context.lineWidth = 2
  context.strokeStyle = stroke
  context.stroke()
}

function drawPolyline(
  context: CanvasRenderingContext2D,
  shape: PolylineShape,
  style: TerrainStyle,
) {
  if (shape.points.length < 2) {
    return
  }

  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'

  context.beginPath()
  shape.points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y)
      return
    }

    context.lineTo(point.x, point.y)
  })

  context.lineWidth = shape.thickness + 4
  context.strokeStyle = style.stroke
  context.stroke()

  context.lineWidth = shape.thickness
  context.strokeStyle = style.fill
  context.stroke()
  context.restore()
}

function drawSpikes(
  context: CanvasRenderingContext2D,
  body: Matter.Body,
  fill: string,
  stroke: string,
  direction: SpikeDirection,
) {
  const { min, max } = body.bounds
  const width = max.x - min.x
  const height = max.y - min.y

  if (direction === 'left' || direction === 'right') {
    const spikes = Math.max(4, Math.floor(height / 26))
    const spikeHeight = height / spikes
    const pointsLeft = direction === 'left'
    const baseX = pointsLeft ? max.x - 4 : min.x + 4
    const pointX = pointsLeft ? min.x + 2 : max.x - 2

    context.fillStyle = fill
    context.strokeStyle = stroke
    context.lineWidth = 2

    for (let index = 0; index < spikes; index += 1) {
      const top = min.y + index * spikeHeight
      context.beginPath()
      context.moveTo(baseX, top + spikeHeight * 0.08)
      context.lineTo(pointX, top + spikeHeight * 0.5)
      context.lineTo(baseX, top + spikeHeight * 0.92)
      context.closePath()
      context.fill()
      context.stroke()
    }

    return
  }

  const spikes = Math.max(4, Math.floor(width / 26))
  const spikeWidth = width / spikes
  const pointsUp = direction !== 'down'
  const baseY = pointsUp ? max.y - 6 : min.y + 6
  const pointY = pointsUp ? min.y + 2 : max.y - 2

  context.fillStyle = fill
  context.strokeStyle = stroke
  context.lineWidth = 2

  for (let index = 0; index < spikes; index += 1) {
    const left = min.x + index * spikeWidth
    context.beginPath()
    context.moveTo(left + spikeWidth * 0.08, baseY)
    context.lineTo(left + spikeWidth * 0.5, pointY)
    context.lineTo(left + spikeWidth * 0.92, baseY)
    context.closePath()
    context.fill()
    context.stroke()
  }
}

function drawFinishGate(context: CanvasRenderingContext2D, body: Matter.Body) {
  const { min, max } = body.bounds
  const poleX = (min.x + max.x) / 2
  const top = min.y - 18
  const bottom = max.y + 46
  const flagHeight = 62
  const flagWidth = 96

  context.save()
  context.lineCap = 'round'
  context.lineWidth = 10
  context.strokeStyle = '#27393d'
  context.beginPath()
  context.moveTo(poleX, top)
  context.lineTo(poleX, bottom)
  context.stroke()

  context.fillStyle = '#f7f8fb'
  context.strokeStyle = '#27393d'
  context.lineWidth = 3
  context.beginPath()
  context.roundRect(poleX, top + 8, flagWidth, flagHeight, 8)
  context.fill()
  context.stroke()

  const tile = flagHeight / 3
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      if ((row + column) % 2 === 0) {
        context.fillStyle = '#27393d'
        context.fillRect(poleX + column * tile, top + 8 + row * tile, tile, tile)
      }
    }
  }
  context.restore()
}

function drawInkSegment(
  context: CanvasRenderingContext2D,
  segment: InkSegment,
) {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = INK_THICKNESS
  context.strokeStyle = '#167f90'
  context.shadowBlur = 10
  context.shadowColor = 'rgba(22, 127, 144, 0.22)'
  context.beginPath()
  context.moveTo(segment.from.x, segment.from.y)
  context.lineTo(segment.to.x, segment.to.y)
  context.stroke()

  context.shadowBlur = 0
  context.lineWidth = 3
  context.strokeStyle = 'rgba(229, 255, 252, 0.78)'
  context.stroke()
  context.restore()
}

function drawBall(context: CanvasRenderingContext2D, ball: Matter.Body) {
  context.save()
  context.translate(ball.position.x, ball.position.y)
  context.rotate(ball.angle)

  context.shadowBlur = 18
  context.shadowColor = 'rgba(39, 57, 61, 0.25)'
  const gradient = context.createRadialGradient(-7, -9, 2, 0, 0, BALL_RADIUS)
  gradient.addColorStop(0, '#fff6c7')
  gradient.addColorStop(0.42, '#f6b949')
  gradient.addColorStop(1, '#dc563d')

  context.fillStyle = gradient
  context.beginPath()
  context.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2)
  context.fill()

  context.shadowBlur = 0
  context.lineWidth = 3
  context.strokeStyle = '#7f2d24'
  context.stroke()

  context.lineWidth = 4
  context.strokeStyle = 'rgba(127, 45, 36, 0.58)'
  context.beginPath()
  context.arc(0, 0, BALL_RADIUS * 0.58, -1.2, 1.2)
  context.stroke()
  context.beginPath()
  context.moveTo(-BALL_RADIUS * 0.8, -3)
  context.lineTo(BALL_RADIUS * 0.8, 3)
  context.stroke()
  context.restore()
}

function drawBackdrop(
  context: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  width: number,
  height: number,
) {
  const sky = context.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#cfeefa')
  sky.addColorStop(0.58, '#eff8ec')
  sky.addColorStop(1, '#f7f8fb')
  context.fillStyle = sky
  context.fillRect(0, 0, width, height)

  context.save()
  context.translate(0, -cameraY * 0.08)

  context.fillStyle = 'rgba(255, 199, 94, 0.9)'
  context.beginPath()
  context.arc(width - 120, 92, 42, 0, Math.PI * 2)
  context.fill()

  const hillLayers = [
    { color: '#94d2bd', height: 140, offset: 0.12 },
    { color: '#5aa88e', height: 104, offset: 0.22 },
    { color: '#447a76', height: 74, offset: 0.34 },
  ]

  hillLayers.forEach((layer, layerIndex) => {
    const parallaxX = -(cameraX * layer.offset) % 520
    const baseY = height - 72 + layerIndex * 22
    context.fillStyle = layer.color
    context.beginPath()
    context.moveTo(-80, height)

    for (let x = parallaxX - 560; x < width + 620; x += 260) {
      context.quadraticCurveTo(
        x + 130,
        baseY - layer.height,
        x + 260,
        baseY,
      )
    }

    context.lineTo(width + 80, height)
    context.closePath()
    context.globalAlpha = 0.5 + layerIndex * 0.16
    context.fill()
    context.globalAlpha = 1
  })
  context.restore()
}
