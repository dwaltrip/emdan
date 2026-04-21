import type { TileData } from './types';

function tilesEqual(a: TileData, b: TileData): boolean {
  return (
    a.coord.x === b.coord.x &&
    a.coord.y === b.coord.y &&
    a.terrain === b.terrain &&
    a.owner === b.owner &&
    a.origin === b.origin &&
    a.blobStrength === b.blobStrength &&
    a.growthDirection === b.growthDirection &&
    a.isPlaceable === b.isPlaceable &&
    a.isHovered === b.isHovered
  );
}

export { tilesEqual };
