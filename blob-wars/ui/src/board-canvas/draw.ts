import type { BoardStoreInstance, Coord, TileData } from '@/board-store';

import { dprAwareLineWidth, tileCenter, tileToRect } from './coords';
import type { TileInteraction } from './interaction';
import type { LayoutState } from './layout';
import type { Theme } from './theme';

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function drawAllTiles(
  ctx: Ctx2D,
  store: BoardStoreInstance,
  theme: Theme,
  layout: LayoutState,
): void {
  ctx.fillStyle = theme.GUTTER_COLOR;
  ctx.fillRect(0, 0, layout.backingWidth, layout.backingHeight);

  const { game } = store.state;
  for (let y = 0; y < game.height; y++) {
    for (let x = 0; x < game.width; x++) {
      const tile = store.getTileData({ x, y });
      drawTile(ctx, x, y, tile, theme, layout);
    }
  }
}

function drawTile(
  ctx: Ctx2D,
  x: number,
  y: number,
  tile: TileData,
  theme: Theme,
  layout: LayoutState,
): void {
  const { px, py, size } = tileToRect(x, y, layout.cellDevicePx, layout.gutter);

  if (tile.terrain === 'wall') {
    ctx.fillStyle = theme.WALL_FILL;
    ctx.fillRect(px, py, size, size);
    ctx.strokeStyle = theme.WALL_STROKE;
    ctx.lineWidth = 1;
    // Inset by 0.5 so the 1-device-px stroke lands on whole pixels.
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    return;
  }

  if (tile.owner !== null) {
    ctx.fillStyle = theme.SEAT_COLORS[tile.owner].base;
    ctx.fillRect(px, py, size, size);
    if (tile.origin === 'seed') {
      const { cx, cy } = tileCenter(x, y, layout.cellDevicePx);
      ctx.fillStyle = theme.ORIGIN_SEED_DOT;
      ctx.beginPath();
      ctx.arc(cx, cy, layout.cellDevicePx * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  ctx.fillStyle = theme.TILE_EMPTY_FILL;
  ctx.fillRect(px, py, size, size);
  if (tile.insideExclusion && tile.exclusionSource !== null) {
    ctx.fillStyle = theme.EXCLUSION_TINTS[tile.exclusionSource];
    ctx.fillRect(px, py, size, size);
  }
}

function drawHoverRing(
  ctx: CanvasRenderingContext2D,
  hoverCoord: Coord | null,
  interaction: TileInteraction,
  theme: Theme,
  layout: LayoutState,
): void {
  if (!hoverCoord || interaction.kind !== 'placeable') return;
  const { px, py, size } = tileToRect(hoverCoord.x, hoverCoord.y, layout.cellDevicePx, layout.gutter);
  const palette = theme.SEAT_COLORS[interaction.seat];

  ctx.fillStyle = palette.hoverGlow;
  ctx.fillRect(px, py, size, size);

  const lw = dprAwareLineWidth(layout.dpr);
  ctx.strokeStyle = palette.hoverBorder;
  ctx.lineWidth = lw;
  const inset = lw / 2;
  ctx.strokeRect(px + inset, py + inset, size - lw, size - lw);
}

export { drawAllTiles, drawTile, drawHoverRing };
