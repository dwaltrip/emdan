import type { PlayerSeat } from '@shared/protocol';

import type { BoardStoreInstance, Coord } from '@/board-store';
import type { Session } from '@/session/session';

type TileInteraction =
  | { kind: 'none' }
  | { kind: 'inert' }
  | { kind: 'placeable'; seat: PlayerSeat }
  | { kind: 'disabled'; reason: 'wall' | 'owned' | 'excluded' };

function describeInteraction(
  hoverCoord: Coord | null,
  store: BoardStoreInstance,
  session: Session,
): TileInteraction {
  if (!hoverCoord) return { kind: 'none' };
  if (!session.canPlant()) return { kind: 'inert' };
  const tile = store.getTileData(hoverCoord);
  if (tile.terrain === 'wall') return { kind: 'disabled', reason: 'wall' };
  if (tile.owner !== null) return { kind: 'disabled', reason: 'owned' };
  if (tile.insideExclusion) return { kind: 'disabled', reason: 'excluded' };
  // Non-null: session.canPlant() already returned false if seat is null.
  return { kind: 'placeable', seat: store.state.game.currentUser.seat! };
}

export type { TileInteraction };
export { describeInteraction };
