import { WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { clamp } from '@shared/math';
import type { Point, ViewState } from './types';

const INITIAL_VIEWPORT_HEIGHT = 560;
const INITIAL_VIEWPORT_WIDTH = 960;

export function createView(spawn: Point): ViewState {
  return {
    cameraFrozen: false,
    cameraX: 0,
    cameraY: clamp(
      spawn.y - INITIAL_VIEWPORT_HEIGHT * 0.44,
      0,
      WORLD_HEIGHT - INITIAL_VIEWPORT_HEIGHT,
    ),
    viewportHeight: INITIAL_VIEWPORT_HEIGHT,
    viewportWidth: INITIAL_VIEWPORT_WIDTH,
  };
}

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  view: ViewState,
) {
  const bounds = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, bounds.width);
  const height = Math.max(420, bounds.height);

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  view.viewportWidth = width;
  view.viewportHeight = height;
}

export function updateCamera(view: ViewState, target: Point, lockY: boolean) {
  if (view.cameraFrozen) {
    return;
  }

  const maxCameraX = Math.max(0, WORLD_WIDTH - view.viewportWidth);
  const targetX = clamp(target.x - view.viewportWidth * 0.34, 0, maxCameraX);
  const maxCameraY = Math.max(0, WORLD_HEIGHT - view.viewportHeight);
  const targetY = clamp(target.y - view.viewportHeight * 0.44, 0, maxCameraY);

  view.cameraX += (targetX - view.cameraX) * 0.09;
  if (!lockY) {
    view.cameraY += (targetY - view.cameraY) * 0.11;
  }
}

export function screenToWorld(view: ViewState, point: Point): Point {
  return {
    x: point.x + view.cameraX,
    y: point.y + view.cameraY,
  };
}
