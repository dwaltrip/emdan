import type { BlobWarsBoardStoreInstance } from "@/board-store";
import { useTileData } from "@/board-store";
import type { PlayerSeat } from "@shared/protocol";
import "./board.css";

interface BoardProps {
  store: BlobWarsBoardStoreInstance;
  width: number;
  height: number;
  seat: PlayerSeat | null;
  canPlant: boolean;
  onPlant: (x: number, y: number) => void;
}

export function Board({ store, width, height, seat, canPlant, onPlant }: BoardProps) {
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({ x, y });
    }
  }

  const boardClass = seat ? `board board-seat-${seat}` : "board";

  return (
    <div className={boardClass} style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}>
      {cells.map(({ x, y }) => (
        <Tile
          key={`${x}-${y}`}
          store={store}
          x={x}
          y={y}
          canPlant={canPlant}
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
  canPlant: boolean;
  onPlant: (x: number, y: number) => void;
}

function Tile({ store, x, y, canPlant, onPlant }: TileProps) {
  const tile = useTileData(store, { x, y });
  const isWall = tile.terrain === "wall";
  const ownerClass = tile.owner ?? "empty";
  const originClass = tile.origin ?? "empty";
  const disabled = isWall || tile.owner !== null || tile.insideExclusion || !canPlant;
  const title = isWall
    ? `(${x}, ${y}) impassable`
    : tile.owner !== null
      ? `(${x}, ${y}) ${tile.owner} ${tile.origin ?? "spread"}`
      : tile.insideExclusion
        ? `(${x}, ${y}) too close to an existing seed`
        : canPlant
          ? `Plant at (${x}, ${y})`
          : `(${x}, ${y})`;
  const ariaLabel = isWall
    ? `Impassable tile at ${x}, ${y}`
    : tile.owner !== null
      ? `Tile ${x}, ${y} owned by ${tile.owner}, ${tile.origin ?? "spread"}`
      : tile.insideExclusion
        ? `Tile ${x}, ${y} is inside another seed's exclusion zone`
        : canPlant
          ? `Plant seed at ${x}, ${y}`
          : `Tile ${x}, ${y}`;
  const classes = [
    "tile",
    isWall ? "tile-wall" : `tile-${ownerClass} tile-origin-${originClass}`,
  ];
  if (tile.insideExclusion) {
    classes.push("tile-in-exclusion-zone");
    classes.push(`tile-in-exclusion-zone-${tile.exclusionSource}`);
  }
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
