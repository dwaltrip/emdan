import type { BlobWarsBoardStoreInstance } from "./board-store";
import { useTileData } from "./board-store";

interface BoardProps {
  store: BlobWarsBoardStoreInstance;
  width: number;
  height: number;
  connected: boolean;
  onPlant: (x: number, y: number) => void;
}

export function Board({ store, width, height, connected, onPlant }: BoardProps) {
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({ x, y });
    }
  }

  return (
    <div className="board" style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}>
      {cells.map(({ x, y }) => (
        <Tile
          key={`${x}-${y}`}
          store={store}
          x={x}
          y={y}
          connected={connected}
          onPlant={onPlant}
        />
      ))}
    </div>
  );
}

interface TileProps {
  store: BlobWarsBoardStoreInstance;
  x: number;
  y: number;
  connected: boolean;
  onPlant: (x: number, y: number) => void;
}

function Tile({ store, x, y, connected, onPlant }: TileProps) {
  const tile = useTileData(store, { x, y });
  const ownerClass = tile.owner ?? "empty";
  const originClass = tile.origin ?? "empty";
  const disabled = tile.owner !== null || !connected;
  const title =
    tile.owner === null
      ? `Plant at (${x}, ${y})`
      : `(${x}, ${y}) ${tile.owner} ${tile.origin ?? "spread"}`;
  const ariaLabel =
    tile.owner === null
      ? `Plant seed at ${x}, ${y}`
      : `Tile ${x}, ${y} owned by ${tile.owner}, ${tile.origin ?? "spread"}`;

  return (
    <button
      type="button"
      className={`tile tile-${ownerClass} tile-origin-${originClass}`}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onPlant(x, y)}
    />
  );
}
