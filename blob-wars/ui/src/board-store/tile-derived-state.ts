import { getNeighbors, serializeCoord } from './coord';
import type {
  BlobId,
  BlobWarsState,
  Coord,
  GrowthDirection,
  TileData,
} from './types';

function computeTileData(state: BlobWarsState, coord: Coord): TileData {
  const { game, ui, blobs, tileToBlobId } = state;
  const tile = game.tiles[coord.y][coord.x];
  const key = serializeCoord(coord);

  const blobId = tileToBlobId.get(key);
  const blob = blobId !== undefined ? blobs.get(blobId) : undefined;
  const blobStrength = blob?.seedCount ?? 0;

  const growthDirection = computeGrowthDirection(state, coord, blobId);

  const isHovered =
    ui.hoveredCoord !== null &&
    ui.hoveredCoord.x === coord.x &&
    ui.hoveredCoord.y === coord.y;

  return {
    coord,
    owner: tile.owner,
    origin: tile.origin,
    blobStrength,
    growthDirection,
    isPlaceable: tile.owner === null,
    isHovered,
  };
}

function computeGrowthDirection(
  state: BlobWarsState,
  coord: Coord,
  blobId: BlobId | undefined,
): GrowthDirection {
  if (blobId === undefined) return 'none';
  const blob = state.blobs.get(blobId);
  if (!blob) return 'none';

  const myStrength = blob.seedCount;
  const neighbors = getNeighbors(coord, state.game.width, state.game.height);

  let touchesEmpty = false;
  let strongestEnemyStrength = -1;
  let hasEnemy = false;

  for (const neighbor of neighbors) {
    const nTile = state.game.tiles[neighbor.y][neighbor.x];
    if (nTile.owner === null) {
      touchesEmpty = true;
      continue;
    }
    if (nTile.owner === blob.owner) continue;

    hasEnemy = true;
    const nBlobId = state.tileToBlobId.get(serializeCoord(neighbor));
    if (nBlobId === undefined) continue;
    const nStrength = state.blobs.get(nBlobId)?.seedCount ?? 0;
    if (nStrength > strongestEnemyStrength) strongestEnemyStrength = nStrength;
  }

  if (!hasEnemy && !touchesEmpty) return 'none';
  if (hasEnemy && myStrength < strongestEnemyStrength) return 'negative';
  if (hasEnemy && myStrength === strongestEnemyStrength && !touchesEmpty) {
    return 'neutral';
  }
  return 'positive';
}

export { computeTileData };
