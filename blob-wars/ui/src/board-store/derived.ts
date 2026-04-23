import type { BlobWarsInputState, DerivedState } from './types';

// Placeholder. Populate when a future UI consumer needs cross-tile derived
// state (e.g. blob membership, aggregate stats). Kept wired into the store so
// additions don't require re-plumbing createStore.
function deriveBlobWarsState(_state: BlobWarsInputState): DerivedState {
  return {};
}

export { deriveBlobWarsState };
