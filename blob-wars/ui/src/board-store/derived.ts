import { SEED_EXCLUSION_RADIUS } from '@shared/protocol';
import { circularNeighborhood } from '@shared/geometry';

import { serializeCoord } from './coord';
import type { BlobWarsInputState, CoordKey, DerivedState, PlayerId } from './types';

function deriveBlobWarsState(state: BlobWarsInputState): DerivedState {
  return { excludedCoords: computeExcludedCoords(state) };
}

function computeExcludedCoords(state: BlobWarsInputState): Map<CoordKey, Set<PlayerId>> {
  const excluded = new Map<CoordKey, Set<PlayerId>>();
  if (state.game.phase !== 'placing') return excluded;

  const bounds = { width: state.game.width, height: state.game.height };
  for (let y = 0; y < state.game.height; y++) {
    for (let x = 0; x < state.game.width; x++) {
      const tile = state.game.tiles[y]![x]!;
      if (tile.origin !== 'seed' || tile.owner === null) continue;
      for (const [nx, ny] of circularNeighborhood(x, y, SEED_EXCLUSION_RADIUS, bounds)) {
        const key = serializeCoord({ x: nx, y: ny });
        let owners = excluded.get(key);
        if (!owners) {
          owners = new Set();
          excluded.set(key, owners);
        }
        owners.add(tile.owner);
      }
    }
  }
  return excluded;
}

export { deriveBlobWarsState };
