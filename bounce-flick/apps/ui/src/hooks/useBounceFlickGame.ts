import { useCallback, useEffect, useRef, useState } from 'react';
import { FIXED_STEP, INITIAL_HUD } from '../game/constants';
import { bindKeyboardControls, bindPointerControls } from '../game/input';
import {
  advanceFrame,
  bindCollisionHandlers,
  clearDrawings,
  createHudSnapshot,
  createRuntime,
  destroyRuntime,
  eraseRecentInk,
} from '../game/physics';
import { renderScene } from '../game/renderer';
import { createView, resizeCanvas, updateCamera } from '../game/view';
import type { GeneratedLevel } from '../game/types';
import type { Multiplayer } from '../net/session';

type GameActions = {
  clearInk: () => void;
  eraseRecentInk: () => void;
};

type UseBounceFlickGameParams = {
  level: GeneratedLevel;
  multiplayer?: Multiplayer;
};

export function useBounceFlickGame({ level, multiplayer }: UseBounceFlickGameParams) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const actionsRef = useRef<GameActions | null>(null);
  const [hud, setHud] = useState(INITIAL_HUD);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    const runtime = createRuntime(level);
    const view = createView(level.spawn);
    let accumulator = 0;
    let lastFrame = performance.now();
    let lastHudAt = 0;
    let rafId = 0;
    let reportedFinish = false;

    const publishHud = (force = false) => {
      const now = performance.now();
      if (!force && now - lastHudAt < 90) {
        return;
      }
      lastHudAt = now;
      setHud(createHudSnapshot(runtime));
    };

    const pointerControls = bindPointerControls(canvas, runtime, view, publishHud);
    const actions: GameActions = {
      clearInk: () => {
        clearDrawings(runtime);
        publishHud(true);
      },
      eraseRecentInk: () => {
        pointerControls.cancelActiveStroke();
        eraseRecentInk(runtime);
        publishHud(true);
      },
    };
    const cleanupKeyboard = bindKeyboardControls(view, {
      clearDrawings: actions.clearInk,
      eraseRecentInk: actions.eraseRecentInk,
    });
    const cleanupCollisions = bindCollisionHandlers(runtime, () => publishHud(true));
    const resize = () => resizeCanvas(canvas, context, view);
    const resizeObserver = new ResizeObserver(resize);

    const frame = (now: number) => {
      const delta = Math.min(now - lastFrame, 80);
      lastFrame = now;
      accumulator += delta;

      while (accumulator >= FIXED_STEP) {
        if (advanceFrame(runtime, FIXED_STEP)) {
          publishHud(true);
        }
        accumulator -= FIXED_STEP;
      }

      updateCamera(view, runtime.ball.position, pointerControls.isDrawing());
      pointerControls.syncAfterCameraMove();

      if (multiplayer) {
        multiplayer.publishPosition({ x: runtime.ball.position.x, y: runtime.ball.position.y });
        if (runtime.phase === 'cleared' && !reportedFinish) {
          reportedFinish = true;
          multiplayer.finish();
        }
      }

      renderScene(context, runtime, view, multiplayer?.readPeers());
      publishHud();
      rafId = window.requestAnimationFrame(frame);
    };

    resizeObserver.observe(canvas);
    resize();
    actionsRef.current = actions;
    publishHud(true);
    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      pointerControls.cleanup();
      cleanupKeyboard();
      cleanupCollisions();
      destroyRuntime(runtime);
      actionsRef.current = null;
    };
  }, [level, multiplayer]);

  return {
    canvasRef,
    clearInk: useCallback(() => actionsRef.current?.clearInk(), []),
    eraseRecentInk: useCallback(() => actionsRef.current?.eraseRecentInk(), []),
    hud,
  };
}
