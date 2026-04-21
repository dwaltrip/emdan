import { getNeighbors, serializeCoord } from './coord';
import type {
  Blob,
  BlobId,
  BlobWarsInputState,
  Coord,
  CoordKey,
  DerivedState,
  Player,
  PlayerId,
  TileSource,
} from './types';
import { PLACEMENT_COOLDOWN } from './types';

function deriveBlobWarsState(state: BlobWarsInputState): DerivedState {
  const { game } = state;
  const blobs = new Map<BlobId, Blob>();
  const tileToBlobId = new Map<CoordKey, BlobId>();

  let nextBlobId = 0;
  for (let y = 0; y < game.height; y++) {
    for (let x = 0; x < game.width; x++) {
      const tile = game.tiles[y][x];
      if (tile.ownerPlayerId === null) continue;
      const key = serializeCoord({ x, y });
      if (tileToBlobId.has(key)) continue;

      const blob = floodFillBlob(
        nextBlobId,
        { x, y },
        game.tiles,
        game.width,
        game.height,
        tileToBlobId,
      );
      blobs.set(nextBlobId, blob);
      nextBlobId++;
    }
  }

  const ticksUntilPlacementByPlayer = computeCooldowns(game.players, game.tick);

  return { blobs, tileToBlobId, ticksUntilPlacementByPlayer };
}

function floodFillBlob(
  id: BlobId,
  start: Coord,
  tiles: TileSource[][],
  width: number,
  height: number,
  tileToBlobId: Map<CoordKey, BlobId>,
): Blob {
  const ownerPlayerId = tiles[start.y][start.x].ownerPlayerId!;
  const visited: Coord[] = [];
  const stack: Coord[] = [start];
  let seedCount = 0;
  const borderSet = new Map<CoordKey, Coord>();

  while (stack.length > 0) {
    const coord = stack.pop()!;
    const key = serializeCoord(coord);
    if (tileToBlobId.has(key)) continue;

    const tile = tiles[coord.y][coord.x];
    if (tile.ownerPlayerId !== ownerPlayerId) continue;

    tileToBlobId.set(key, id);
    visited.push(coord);
    if (tile.type === 'seed') seedCount++;

    let isBorder = false;
    for (const neighbor of getNeighbors(coord, width, height)) {
      const neighborTile = tiles[neighbor.y][neighbor.x];
      if (neighborTile.ownerPlayerId === ownerPlayerId) {
        stack.push(neighbor);
      } else {
        isBorder = true;
      }
    }
    if (isBorder) borderSet.set(key, coord);
  }

  return {
    id,
    ownerPlayerId,
    tiles: visited,
    seedCount,
    borderTiles: Array.from(borderSet.values()),
  };
}

function computeCooldowns(players: Player[], currentTick: number): Map<PlayerId, number> {
  const result = new Map<PlayerId, number>();
  for (const player of players) {
    if (player.lastPlacementTick < 0) {
      result.set(player.id, 0);
      continue;
    }
    const elapsed = currentTick - player.lastPlacementTick;
    const remaining = Math.max(0, PLACEMENT_COOLDOWN - elapsed);
    result.set(player.id, remaining);
  }
  return result;
}

export { deriveBlobWarsState };
