import type { BlobWarsBoardStoreInstance } from "@/board-store";
import { useTileData } from "@/board-store";
import "./board.css";

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
  const isWall = tile.terrain === "wall";
  const ownerClass = tile.owner ?? "empty";
  const originClass = tile.origin ?? "empty";
  const disabled = isWall || tile.owner !== null || tile.insideExclusion || !connected;
  const title = isWall
    ? `(${x}, ${y}) impassable`
    : tile.insideExclusion
      ? `(${x}, ${y}) too close to an existing seed`
      : tile.owner === null
        ? `Plant at (${x}, ${y})`
        : `(${x}, ${y}) ${tile.owner} ${tile.origin ?? "spread"}`;
  const ariaLabel = isWall
    ? `Impassable tile at ${x}, ${y}`
    : tile.insideExclusion
      ? `Tile ${x}, ${y} is inside another seed's exclusion zone`
      : tile.owner === null
        ? `Plant seed at ${x}, ${y}`
        : `Tile ${x}, ${y} owned by ${tile.owner}, ${tile.origin ?? "spread"}`;
  const classes = [
    "tile",
    isWall ? "tile-wall" : `tile-${ownerClass} tile-origin-${originClass}`,
  ];
  if (tile.insideExclusion) classes.push("tile-in-exclusion-zone");
  if (disabled) classes.push("tile-disabled");

  return (
    <div
      className={classes.join(" ")}
      title={title}
      role="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onClick={disabled ? undefined : () => onPlant(x, y)}
    />
  );
}
