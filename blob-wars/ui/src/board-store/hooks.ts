import { useCallback, useSyncExternalStore } from 'react';

import type { BlobWarsBoardStoreInstance } from './board-store';
import type { BlobWarsInputState, Coord, TileData } from './types';

function useTileData(store: BlobWarsBoardStoreInstance, coord: Coord): TileData {
  const subscribe = useCallback(
    (cb: () => void) => store.subscribeTile(coord, cb),
    [store, coord.x, coord.y],
  );
  const getSnapshot = useCallback(
    () => store.getTileData(coord),
    [store, coord.x, coord.y],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

function useBoardState(store: BlobWarsBoardStoreInstance): BlobWarsInputState {
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => store.version, [store]);
  useSyncExternalStore(subscribe, getSnapshot);
  return store.state;
}

export { useTileData, useBoardState };
