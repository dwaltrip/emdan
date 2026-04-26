import type { Coord } from '@/board-store';

interface TileRect {
  px: number;
  py: number;
  size: number;
}

interface TileCenter {
  cx: number;
  cy: number;
}

function tileToRect(x: number, y: number, cellDevicePx: number, gutter: number): TileRect {
  return {
    px: x * cellDevicePx,
    py: y * cellDevicePx,
    size: cellDevicePx - gutter,
  };
}

function tileCenter(x: number, y: number, cellDevicePx: number): TileCenter {
  return {
    cx: x * cellDevicePx + cellDevicePx / 2,
    cy: y * cellDevicePx + cellDevicePx / 2,
  };
}

// Always returns an in-bounds coord. Pointer events outside the canvas are
// filtered by pointerleave; the clamp also covers eventX === rect.right
// exactly (which would otherwise floor to gridWidth).
function pixelToTile(
  rect: DOMRect,
  eventX: number,
  eventY: number,
  gridWidth: number,
  gridHeight: number,
): Coord {
  const x = Math.floor(((eventX - rect.left) / rect.width) * gridWidth);
  const y = Math.floor(((eventY - rect.top) / rect.height) * gridHeight);
  return {
    x: Math.max(0, Math.min(gridWidth - 1, x)),
    y: Math.max(0, Math.min(gridHeight - 1, y)),
  };
}

function dprAwareLineWidth(dpr: number): number {
  return Math.max(1, Math.round(dpr));
}

export type { TileRect, TileCenter };
export { tileToRect, tileCenter, pixelToTile, dprAwareLineWidth };
