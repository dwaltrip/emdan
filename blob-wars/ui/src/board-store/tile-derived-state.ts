import { serializeCoord } from './coord';
import type { BlobWarsState, Coord, ExclusionSource, PlayerId, TileData } from './types';

function computeTileData(state: BlobWarsState, coord: Coord): TileData {
  const { game, excludedCoords } = state;
  const tile = game.tiles[coord.y][coord.x];

  const isPlaceable = tile.terrain === 'blank' && tile.owner === null;
  const owners = isPlaceable ? excludedCoords.get(serializeCoord(coord)) ?? null : null;
  const insideExclusion = owners !== null;
  const exclusionSource = toExclusionSource(owners);

  return {
    coord,
    terrain: tile.terrain,
    owner: tile.owner,
    origin: tile.origin,
    isPlaceable,
    insideExclusion,
    exclusionSource,
  };
}

function toExclusionSource(owners: Set<PlayerId> | null): ExclusionSource {
  if (!owners || owners.size === 0) return null;
  if (owners.size > 1) return 'both';
  return owners.values().next().value!;
}

export { computeTileData };
