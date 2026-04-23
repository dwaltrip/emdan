import clsx from "clsx";

import type { BlobWarsBoardStoreInstance } from "@/board-store";
import { useTileData } from "@/board-store";
import { perfLog } from "@/lib/perf-log";
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

  return (
    <div
      className={clsx("board", seat && `board-seat-${seat}`)}
      style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
    >
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
  perfLog.bumpTileRender();
  const tile = useTileData(store, { x, y });
  const isWall = tile.terrain === "wall";
  const ownerClass = tile.owner ?? "empty";
  const originClass = tile.origin ?? "empty";
  const disabled = isWall || tile.owner !== null || tile.insideExclusion || !canPlant;

  return (
    <div
      className={clsx(
        "tile",
        isWall ? "tile-wall" : [`tile-${ownerClass}`, `tile-origin-${originClass}`],
        tile.insideExclusion && [
          "tile-in-exclusion-zone",
          `tile-in-exclusion-zone-${tile.exclusionSource}`,
        ],
        disabled && "tile-disabled",
      )}
      onClick={disabled ? undefined : () => onPlant(x, y)}
    />
  );
}
