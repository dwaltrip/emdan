import {
  addInkSegment,
  clampDrawingPoint,
} from './physics'
import type { Point, Runtime } from './types'

type PublishHud = (force?: boolean) => void

export function bindPointerControls(
  canvas: HTMLCanvasElement,
  runtime: Runtime,
  publishHud: PublishHud,
) {
  const handlePointerDown = (event: PointerEvent) => {
    if (runtime.phase !== 'running' || event.button !== 0) {
      return
    }

    event.preventDefault()
    canvas.setPointerCapture(event.pointerId)
    const pointerScreen = eventToCanvasPoint(canvas, event)
    runtime.pointerId = event.pointerId
    runtime.pointerScreen = pointerScreen
    runtime.lastPointer = clampDrawingPoint(
      canvasPointToWorld(runtime, pointerScreen),
    )
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (runtime.pointerId !== event.pointerId || !runtime.lastPointer) {
      return
    }

    event.preventDefault()
    const pointerScreen = eventToCanvasPoint(canvas, event)
    runtime.pointerScreen = pointerScreen
    const target = clampDrawingPoint(
      canvasPointToWorld(runtime, pointerScreen),
    )
    runtime.lastPointer = addInkSegment(runtime, runtime.lastPointer, target)
    publishHud(true)
  }

  const endPointer = (event: PointerEvent) => {
    if (runtime.pointerId !== event.pointerId) {
      return
    }

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }

    runtime.pointerId = null
    runtime.lastPointer = null
    runtime.pointerScreen = null
  }

  canvas.addEventListener('pointerdown', handlePointerDown)
  canvas.addEventListener('pointermove', handlePointerMove)
  canvas.addEventListener('pointerup', endPointer)
  canvas.addEventListener('pointercancel', endPointer)

  return () => {
    canvas.removeEventListener('pointerdown', handlePointerDown)
    canvas.removeEventListener('pointermove', handlePointerMove)
    canvas.removeEventListener('pointerup', endPointer)
    canvas.removeEventListener('pointercancel', endPointer)
  }
}

function eventToCanvasPoint(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
): Point {
  const bounds = canvas.getBoundingClientRect()

  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  }
}

function canvasPointToWorld(runtime: Runtime, point: Point): Point {
  return {
    x: point.x + runtime.cameraX,
    y: point.y + runtime.cameraY,
  }
}
