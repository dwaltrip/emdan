import { useCallback, useSyncExternalStore } from 'react';

import type { BoardStoreInstance, Coord, TileData } from '@/board-store';

function useTileData(store: BoardStoreInstance, coord: Coord): TileData {
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

export { useTileData };
