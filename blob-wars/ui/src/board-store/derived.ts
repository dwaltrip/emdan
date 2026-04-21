import { getNeighbors, serializeCoord } from './coord';
import type {
  Blob,
  BlobId,
  BlobWarsInputState,
  Coord,
  CoordKey,
  DerivedState,
  TileSource,
} from './types';

function deriveBlobWarsState(state: BlobWarsInputState): DerivedState {
  const { game } = state;
  const blobs = new Map<BlobId, Blob>();
  const tileToBlobId = new Map<CoordKey, BlobId>();

  let nextBlobId = 0;
  for (let y = 0; y < game.height; y++) {
    for (let x = 0; x < game.width; x++) {
      const tile = game.tiles[y][x];
      if (tile.owner === null) continue;
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

  return { blobs, tileToBlobId };
}

function floodFillBlob(
  id: BlobId,
  start: Coord,
  tiles: TileSource[][],
  width: number,
  height: number,
  tileToBlobId: Map<CoordKey, BlobId>,
): Blob {
  const owner = tiles[start.y][start.x].owner!;
  const visited: Coord[] = [];
  const stack: Coord[] = [start];
  let seedCount = 0;
  const borderSet = new Map<CoordKey, Coord>();

  while (stack.length > 0) {
    const coord = stack.pop()!;
    const key = serializeCoord(coord);
    if (tileToBlobId.has(key)) continue;

    const tile = tiles[coord.y][coord.x];
    if (tile.owner !== owner) continue;

    tileToBlobId.set(key, id);
    visited.push(coord);
    if (tile.origin === 'seed') seedCount++;

    let isBorder = false;
    for (const neighbor of getNeighbors(coord, width, height)) {
      const neighborTile = tiles[neighbor.y][neighbor.x];
      if (neighborTile.owner === owner) {
        stack.push(neighbor);
      } else {
        isBorder = true;
      }
    }
    if (isBorder) borderSet.set(key, coord);
  }

  return {
    id,
    owner,
    tiles: visited,
    seedCount,
    borderTiles: Array.from(borderSet.values()),
  };
}

export { deriveBlobWarsState };
