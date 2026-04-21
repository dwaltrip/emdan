import type { TileData } from './types';

function tilesEqual(a: TileData, b: TileData): boolean {
  return (
    a.coord.x === b.coord.x &&
    a.coord.y === b.coord.y &&
    a.ownerPlayerId === b.ownerPlayerId &&
    a.type === b.type &&
    a.blobStrength === b.blobStrength &&
    a.growthDirection === b.growthDirection &&
    a.isPendingPlacement === b.isPendingPlacement &&
    a.pendingPlacementByPlayerId === b.pendingPlacementByPlayerId &&
    a.isPlaceableForActiveInputPlayer === b.isPlaceableForActiveInputPlayer &&
    a.isHovered === b.isHovered
  );
}

export { tilesEqual };
