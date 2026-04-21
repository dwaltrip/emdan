import type { Coord, CoordKey } from './types';

const NEIGHBOR_OFFSETS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

function serializeCoord(coord: Coord): CoordKey {
  return `${coord.x},${coord.y}`;
}

function deserializeCoord(key: CoordKey): Coord {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

function isAdjacent(a: Coord, b: Coord): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

function getNeighbors(coord: Coord, width: number, height: number): Coord[] {
  const result: Coord[] = [];
  for (const { dx, dy } of NEIGHBOR_OFFSETS) {
    const x = coord.x + dx;
    const y = coord.y + dy;
    if (x >= 0 && x < width && y >= 0 && y < height) {
      result.push({ x, y });
    }
  }
  return result;
}

export { NEIGHBOR_OFFSETS, serializeCoord, deserializeCoord, isAdjacent, getNeighbors };
