import { useEffect } from 'react'
import { FIXED_STEP } from '../game/constants'
import { bindKeyboardControls, bindPointerControls } from '../game/input'
import {
  advanceFrame,
  bindCollisionHandlers,
  clearDrawings,
  createHudSnapshot,
  createRuntime,
  destroyRuntime,
} from '../game/physics'
import { renderScene, resizeCanvas } from '../game/renderer'
import type { GameActions, GeneratedLevel, HudSnapshot } from '../game/types'

type NetBridge = {
  sendBall: (x: number, y: number) => void
  getGhostBalls: () => Array<{ x: number; y: number }>
  reportFinish: (elapsedMs: number) => void
}

type UseBounceFlickGameParams = {
  actionsRef: {
    current: GameActions | null
  }
  canvasRef: {
    current: HTMLCanvasElement | null
  }
  level: GeneratedLevel
  net?: NetBridge
  setHud: (snapshot: HudSnapshot) => void
}

export function useBounceFlickGame({
  actionsRef,
  canvasRef,
  level,
  net,
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
    const startedAt = performance.now()
    let reportedFinish = false

    const frame = (now: number) => {
      const delta = Math.min(now - lastFrame, 80)
      lastFrame = now
      accumulator += delta

      while (accumulator >= FIXED_STEP) {
        if (advanceFrame(runtime, FIXED_STEP)) {
          publishHud(true)
        }
        accumulator -= FIXED_STEP
      }

      if (net) {
        runtime.ghostBalls = net.getGhostBalls()
        net.sendBall(runtime.ball.position.x, runtime.ball.position.y)

        if (runtime.phase === 'cleared' && !reportedFinish) {
          reportedFinish = true
          net.reportFinish(performance.now() - startedAt)
        }
      }

      renderScene(context, runtime)
      publishHud()
      runtime.rafId = window.requestAnimationFrame(frame)
    }

    const resizeObserver = new ResizeObserver(resize)
    const cleanupInput = bindPointerControls(canvas, runtime, publishHud)
    const cleanupKeyboard = bindKeyboardControls(runtime, () => {
      clearDrawings(runtime)
      publishHud(true)
    })
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
      cleanupKeyboard()
      cleanupCollisions()
      destroyRuntime(runtime)
      if (actionsRef.current?.clearDrawings) {
        actionsRef.current = null
      }
    }
  }, [actionsRef, canvasRef, level, net, setHud])
}
