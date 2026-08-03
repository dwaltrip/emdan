// Helpers for asserting properties of emitted GeneratedLevel data.

import { WALL_THICKNESS } from '@shared/game-config';
import type { GeneratedLevel, PlatformRole, PlatformSpec, Point, WallSpec } from '@shared/level';
import { offsetPolylineSegments, segmentSpanX, segmentsYAt } from '../../src/geometry';
import type { Segment } from '../../src/geometry';

// mulberry32: deterministic [0,1) PRNG, so a seed reproduces a level exactly.
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function corridorInnerFaces(level: GeneratedLevel): {
  ceiling: Segment[];
  floor: Segment[];
} {
  const walls = level.pieces.filter((piece): piece is WallSpec => piece.type === 'wall');
  if (walls.length !== 2) {
    throw new Error(`expected 2 corridor walls, found ${walls.length}`);
  }

  const sortedWalls = [...walls].sort((a, b) => meanWallY(a) - meanWallY(b));
  const top = sortedWalls[0]!;
  const bottom = sortedWalls[1]!;

  return {
    ceiling: wallInnerFace(top, 1),
    floor: wallInnerFace(bottom, -1),
  };
}

export function platformTopEdge(spec: PlatformSpec): Segment {
  const { x, y, width, height, angle = 0 } = spec.rect;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corner = (dx: number, dy: number): Point => ({
    x: x + dx * cos - dy * sin,
    y: y + dx * sin + dy * cos,
  });
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const edgeA: Segment = {
    from: corner(-halfWidth, -halfHeight),
    to: corner(halfWidth, -halfHeight),
  };
  const edgeB: Segment = {
    from: corner(-halfWidth, halfHeight),
    to: corner(halfWidth, halfHeight),
  };
  const meanY = (edge: Segment) => (edge.from.y + edge.to.y) / 2;
  return meanY(edgeA) <= meanY(edgeB) ? edgeA : edgeB;
}

export function startPlatform(level: GeneratedLevel): PlatformSpec {
  return platformWithRole(level, 'start');
}

export function finishPlatform(level: GeneratedLevel): PlatformSpec {
  return platformWithRole(level, 'finish');
}

export function minVerticalGapAbove(
  ceiling: Segment[],
  surface: Segment,
  samples = 24,
): number | null {
  const { left, right } = segmentSpanX(surface);
  let min: number | null = null;
  for (let step = 0; step <= samples; step += 1) {
    const x = left + ((right - left) * step) / samples;
    const ceilingY = segmentsYAt(ceiling, x, Math.max);
    if (ceilingY === null) {
      continue;
    }
    const surfaceY =
      surface.from.y +
      ((surface.to.y - surface.from.y) * (x - surface.from.x)) / (surface.to.x - surface.from.x);
    const headroom = surfaceY - ceilingY;
    min = min === null ? headroom : Math.min(min, headroom);
  }
  return min;
}

function platformWithRole(level: GeneratedLevel, role: PlatformRole): PlatformSpec {
  const platform = level.pieces.find(
    (piece): piece is PlatformSpec => piece.type === 'platform' && piece.role === role,
  );
  if (!platform) {
    throw new Error(`generated level is missing its ${role} platform`);
  }
  return platform;
}

function wallInnerFace(spec: WallSpec, towardInterior: 1 | -1): Segment[] {
  return offsetPolylineSegments(spec.points, (towardInterior * WALL_THICKNESS) / 2);
}

function meanWallY(spec: WallSpec) {
  return spec.points.reduce((sum, point) => sum + point.y, 0) / spec.points.length;
}
