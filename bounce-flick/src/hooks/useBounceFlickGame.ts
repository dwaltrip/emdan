import { useEffect } from 'react'
import { FIXED_STEP } from '../game/constants'
import { bindPointerControls } from '../game/input'
import {
  bindCollisionHandlers,
  clearDrawings,
  createHudSnapshot,
  createRuntime,
  destroyRuntime,
  stepEngine,
  tickPhysics,
} from '../game/physics'
import { renderScene, resizeCanvas } from '../game/renderer'
import type { GameActions, GeneratedLevel, HudSnapshot } from '../game/types'

type UseBounceFlickGameParams = {
  actionsRef: {
    current: GameActions | null
  }
  canvasRef: {
    current: HTMLCanvasElement | null
  }
  level: GeneratedLevel
  setHud: (snapshot: HudSnapshot) => void
}

export function useBounceFlickGame({
  actionsRef,
  canvasRef,
  level,
  setHud,
}: UseBounceFlickGameParams) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const runtime = createRuntime(level)

    const publishHud = (force = false) => {
      const now = performance.now()
      if (!force && now - runtime.lastHudAt < 90) {
        return
      }

      runtime.lastHudAt = now
      setHud(createHudSnapshot(runtime))
    }

    const resize = () => {
      resizeCanvas(canvas, context, runtime)
    }

    let lastFrame = performance.now()
    let accumulator = 0

    const frame = (now: number) => {
      const delta = Math.min(now - lastFrame, 80)
      lastFrame = now
      accumulator += delta

      while (accumulator >= FIXED_STEP) {
        if (tickPhysics(runtime, FIXED_STEP / 1000)) {
          publishHud(true)
        }
        stepEngine(runtime, FIXED_STEP)
        accumulator -= FIXED_STEP
      }

      renderScene(context, runtime)
      publishHud()
      runtime.rafId = window.requestAnimationFrame(frame)
    }

    const resizeObserver = new ResizeObserver(resize)
    const cleanupInput = bindPointerControls(canvas, runtime, publishHud)
    const cleanupCollisions = bindCollisionHandlers(runtime, () => {
      publishHud(true)
    })

    resizeObserver.observe(canvas)
    resize()
    actionsRef.current = {
      clearDrawings: () => {
        clearDrawings(runtime)
        publishHud(true)
      },
    }
    publishHud(true)
    runtime.rafId = window.requestAnimationFrame(frame)

    return () => {
      window.cancelAnimationFrame(runtime.rafId)
      resizeObserver.disconnect()
      cleanupInput()
      cleanupCollisions()
      destroyRuntime(runtime)
      if (actionsRef.current?.clearDrawings) {
        actionsRef.current = null
      }
    }
  }, [actionsRef, canvasRef, level, setHud])
}
