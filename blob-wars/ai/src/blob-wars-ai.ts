import {
  type ClientMessage,
  type MatchSnapshot,
  type PlayerSeat,
  SEED_EXCLUSION_RADIUS,
} from "@shared/protocol";

export const blobWarsAI = {
  getMove(snapshot: MatchSnapshot, seat: PlayerSeat): ClientMessage | null {
    if (snapshot.phase === "placing") {
      return pickRandomSeed(snapshot, seat);
    }
    return null;
  },
};

function pickRandomSeed(
  snapshot: MatchSnapshot,
  seat: PlayerSeat,
): ClientMessage | null {
  if (snapshot.players[seat].seedsRemaining <= 0) return null;

  const candidates: { x: number; y: number }[] = [];
  const { tiles, width, height } = snapshot.board;

  for (let y = 0; y < height; y += 1) {
    const row = tiles[y]!;
    for (let x = 0; x < width; x += 1) {
      const tile = row[x]!;
      if (tile.terrain !== "blank") continue;
      if (tile.owner !== null) continue;
      if (withinExclusion(snapshot, x, y)) continue;
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) return null;

  const choice = candidates[Math.floor(Math.random() * candidates.length)]!;
  return { type: "plantSeed", x: choice.x, y: choice.y };
}

function withinExclusion(snapshot: MatchSnapshot, x: number, y: number): boolean {
  const { tiles, width, height } = snapshot.board;
  const r = SEED_EXCLUSION_RADIUS;
  const minY = Math.max(0, y - r);
  const maxY = Math.min(height - 1, y + r);
  const minX = Math.max(0, x - r);
  const maxX = Math.min(width - 1, x + r);

  for (let yy = minY; yy <= maxY; yy += 1) {
    const row = tiles[yy]!;
    for (let xx = minX; xx <= maxX; xx += 1) {
      const tile = row[xx]!;
      if (tile.origin === "seed") return true;
    }
  }
  return false;
}
