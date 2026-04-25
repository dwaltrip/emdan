import { memo } from "react";
import clsx from "clsx";

import type { BoardStoreInstance } from "@/board-store";
import type { Session } from "@/session/session";
import { useCanPlant } from "@/hooks/use-can-plant";
import { useTileData } from "@/hooks/use-tile-data";
import { perfLog } from "@/lib/perf-log";
import "./board.css";

interface BoardProps {
  session: Session;
  width: number;
  height: number;
}

export const Board = memo(function Board({ session, width, height }: BoardProps) {
  const canPlant = useCanPlant(session);
  const seat = session.store.state.game.currentUser.seat;

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
          store={session.store}
          x={x}
          y={y}
          canPlant={canPlant}
          plant={session.plant}
        />
      ))}
    </div>
  );
});

interface TileProps {
  store: BoardStoreInstance;
  x: number;
  y: number;
  canPlant: boolean;
  plant: (x: number, y: number) => void;
}

const Tile = memo(function Tile({ store, x, y, canPlant, plant }: TileProps) {
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
      onClick={disabled ? undefined : () => plant(x, y)}
    />
  );
});
