import type { PlayerSeat } from "@shared/protocol";
import { getNeighborCoordinates, type Tile } from "./board";

export interface BlobAnalysis {
  componentIds: (number | null)[][];
  componentPower: Map<number, number>;
}

export interface TileClaim {
  bySeat: Map<PlayerSeat, Set<number>>;
}

export function analyzeBlobs(board: Tile[][]): BlobAnalysis {
  const componentIds = board.map((row) => row.map(() => null as number | null));
  const componentPower = new Map<number, number>();
  let nextComponentId = 0;

  for (let y = 0; y < board.length; y += 1) {
    for (let x = 0; x < board[y]!.length; x += 1) {
      const tile = board[y]![x]!;
      if (tile.owner === null || componentIds[y]![x] !== null) {
        continue;
      }

      const componentId = nextComponentId;
      nextComponentId += 1;

      let power = 0;
      const stack: Array<[number, number]> = [[x, y]];
      componentIds[y]![x] = componentId;

      while (stack.length > 0) {
        const [currentX, currentY] = stack.pop()!;
        const currentTile = board[currentY]![currentX]!;

        if (currentTile.origin === "seed") {
          power += 1;
        }

        for (const [nextX, nextY] of getNeighborCoordinates(currentX, currentY)) {
          const neighbor = board[nextY]![nextX]!;
          if (neighbor.owner !== tile.owner || componentIds[nextY]![nextX] !== null) {
            continue;
          }

          componentIds[nextY]![nextX] = componentId;
          stack.push([nextX, nextY]);
        }
      }

      componentPower.set(componentId, power);
    }
  }

  return {
    componentIds,
    componentPower,
  };
}

export function addClaim(
  claims: Map<string, TileClaim>,
  key: string,
  seat: PlayerSeat,
  componentId: number,
): void {
  const claim = claims.get(key) ?? { bySeat: new Map<PlayerSeat, Set<number>>() };
  const componentIds = claim.bySeat.get(seat) ?? new Set<number>();
  componentIds.add(componentId);
  claim.bySeat.set(seat, componentIds);
  claims.set(key, claim);
}

export function determineClaimWinner(
  claim: TileClaim,
  componentPower: Map<number, number>,
): PlayerSeat | null {
  let winningSeat: PlayerSeat | null = null;
  let winningPower = -1;
  let hasTie = false;

  for (const [seat, componentIds] of claim.bySeat) {
    let totalPower = 0;

    for (const componentId of componentIds) {
      totalPower += componentPower.get(componentId) ?? 0;
    }

    if (totalPower > winningPower) {
      winningSeat = seat;
      winningPower = totalPower;
      hasTie = false;
      continue;
    }

    if (totalPower === winningPower) {
      hasTie = true;
    }
  }

  if (hasTie) {
    return null;
  }

  return winningSeat;
}
