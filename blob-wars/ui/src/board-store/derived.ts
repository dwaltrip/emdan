import { SEED_EXCLUSION_RADIUS } from '@shared/protocol';
import { manhattanNeighborhood } from '@shared/geometry';

import { serializeCoord } from './coord';
import type { BlobWarsInputState, CoordKey, DerivedState } from './types';

function deriveBlobWarsState(state: BlobWarsInputState): DerivedState {
  return { excludedCoords: computeExcludedCoords(state) };
}

function computeExcludedCoords(state: BlobWarsInputState): Set<CoordKey> {
  const excluded = new Set<CoordKey>();
  if (state.game.phase !== 'placing') return excluded;

  const bounds = { width: state.game.width, height: state.game.height };
  for (let y = 0; y < state.game.height; y++) {
    for (let x = 0; x < state.game.width; x++) {
      if (state.game.tiles[y]![x]!.origin !== 'seed') continue;
      for (const [nx, ny] of manhattanNeighborhood(x, y, SEED_EXCLUSION_RADIUS, bounds)) {
        excluded.add(serializeCoord({ x: nx, y: ny }));
      }
    }
  }
  return excluded;
}

export { deriveBlobWarsState };
