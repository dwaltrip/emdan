import { serializeCoord } from './coord';
import type { BlobWarsState, Coord, TileData } from './types';

function computeTileData(state: BlobWarsState, coord: Coord): TileData {
  const { game, ui, excludedCoords } = state;
  const tile = game.tiles[coord.y][coord.x];

  const isHovered =
    ui.hoveredCoord !== null &&
    ui.hoveredCoord.x === coord.x &&
    ui.hoveredCoord.y === coord.y;

  const isPlaceable = tile.terrain === 'blank' && tile.owner === null;
  const insideExclusion = isPlaceable && excludedCoords.has(serializeCoord(coord));

  return {
    coord,
    terrain: tile.terrain,
    owner: tile.owner,
    origin: tile.origin,
    isPlaceable,
    isHovered,
    insideExclusion,
  };
}

export { computeTileData };
