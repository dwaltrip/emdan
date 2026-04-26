import { SEED_EXCLUSION_RADIUS } from '@shared/protocol';
import { circularNeighborhood } from '@shared/geometry';

import { serializeCoord } from './coord';
import type { InputState, CoordKey, Coord, DerivedState, PlayerId } from './types';

type SeedRef = { coord: Coord; owner: PlayerId };

function deriveState(state: InputState): DerivedState {
  const seeds = collectSeeds(state);
  return {
    excludedCoords: computeExcludedCoords(state, seeds),
    seeds,
  };
}

function collectSeeds(state: InputState): SeedRef[] {
  const seeds: SeedRef[] = [];
  for (let y = 0; y < state.game.height; y++) {
    for (let x = 0; x < state.game.width; x++) {
      const tile = state.game.tiles[y]![x]!;
      if (tile.origin === 'seed' && tile.owner !== null) {
        seeds.push({ coord: { x, y }, owner: tile.owner });
      }
    }
  }
  return seeds;
}

function computeExcludedCoords(
  state: InputState,
  seeds: SeedRef[],
): Map<CoordKey, Set<PlayerId>> {
  const excluded = new Map<CoordKey, Set<PlayerId>>();
  if (state.game.phase !== 'placing') return excluded;

  const bounds = { width: state.game.width, height: state.game.height };
  for (const seed of seeds) {
    for (const [nx, ny] of circularNeighborhood(
      seed.coord.x,
      seed.coord.y,
      SEED_EXCLUSION_RADIUS,
      bounds,
    )) {
      const key = serializeCoord({ x: nx, y: ny });
      let owners = excluded.get(key);
      if (!owners) {
        owners = new Set();
        excluded.set(key, owners);
      }
      owners.add(seed.owner);
    }
  }
  return excluded;
}

export { deriveState };
