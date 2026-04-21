import { getNeighbors, serializeCoord } from './coord';
import type {
  BlobId,
  BlobWarsState,
  Coord,
  GrowthDirection,
  PlacementInput,
  PlayerId,
  TileData,
  TileSource,
  TileType,
} from './types';

function computeTileData(state: BlobWarsState, coord: Coord): TileData {
  const { game, ui, blobs, tileToBlobId, ticksUntilPlacementByPlayer } = state;
  const tile = game.tiles[coord.y][coord.x];
  const key = serializeCoord(coord);

  const ownerPlayerId = tile.ownerPlayerId;
  const type: TileType = tile.type ?? 'empty';

  const blobId = tileToBlobId.get(key);
  const blob = blobId !== undefined ? blobs.get(blobId) : undefined;
  const blobStrength = blob?.seedCount ?? 0;

  const growthDirection = computeGrowthDirection(state, coord, blobId);

  const pendingPlacementByPlayerId = findPendingPlacementAt(coord, game.pendingPlacements);
  const isPendingPlacement = pendingPlacementByPlayerId !== null;

  const isPlaceableForActiveInputPlayer = computeIsPlaceable(
    tile,
    ui.activeInputPlayerId,
    ticksUntilPlacementByPlayer,
  );

  const isHovered =
    ui.hoveredCoord !== null &&
    ui.hoveredCoord.x === coord.x &&
    ui.hoveredCoord.y === coord.y;

  return {
    coord,
    ownerPlayerId,
    type,
    blobStrength,
    growthDirection,
    isPendingPlacement,
    pendingPlacementByPlayerId,
    isPlaceableForActiveInputPlayer,
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
    if (nTile.ownerPlayerId === null) {
      touchesEmpty = true;
      continue;
    }
    if (nTile.ownerPlayerId === blob.ownerPlayerId) continue;

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

function findPendingPlacementAt(
  coord: Coord,
  pending: Record<PlayerId, PlacementInput>,
): PlayerId | null {
  for (const [playerId, input] of Object.entries(pending)) {
    if (input.type === 'place' && input.coord.x === coord.x && input.coord.y === coord.y) {
      return playerId;
    }
  }
  return null;
}

function computeIsPlaceable(
  tile: TileSource,
  activeInputPlayerId: PlayerId | null,
  ticksUntilPlacementByPlayer: Map<PlayerId, number>,
): boolean {
  if (activeInputPlayerId === null) return false;
  if (tile.ownerPlayerId !== null) return false;
  const ticksUntil = ticksUntilPlacementByPlayer.get(activeInputPlayerId) ?? 0;
  return ticksUntil === 0;
}

export { computeTileData };
