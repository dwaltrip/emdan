import {
  addInkSegment,
  clampDrawingPoint,
  screenToWorld,
} from './physics'
import type { Runtime } from './types'

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
    runtime.pointerId = event.pointerId
    runtime.lastPointer = clampDrawingPoint(
      screenToWorld(runtime, canvas, event.clientX, event.clientY),
    )
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (runtime.pointerId !== event.pointerId || !runtime.lastPointer) {
      return
    }

    event.preventDefault()
    const target = clampDrawingPoint(
      screenToWorld(runtime, canvas, event.clientX, event.clientY),
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
