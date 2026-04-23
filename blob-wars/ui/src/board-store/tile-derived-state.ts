import type { BlobWarsState, Coord, TileData } from './types';

function computeTileData(state: BlobWarsState, coord: Coord): TileData {
  const { game, ui } = state;
  const tile = game.tiles[coord.y][coord.x];

  const isHovered =
    ui.hoveredCoord !== null &&
    ui.hoveredCoord.x === coord.x &&
    ui.hoveredCoord.y === coord.y;

  return {
    coord,
    terrain: tile.terrain,
    owner: tile.owner,
    origin: tile.origin,
    isPlaceable: tile.terrain === 'blank' && tile.owner === null,
    isHovered,
  };
}

export { computeTileData };
