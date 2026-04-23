import type { PlayerSeat, PlayerState, TileOrigin, TileState, TileTerrain } from '@shared/protocol';

type PlayerId = PlayerSeat;

type CoordKey = string;

interface Coord {
  x: number;
  y: number;
}

type TileSource = TileState;

interface BlobWarsSourceState {
  width: number;
  height: number;
  tiles: TileSource[][];
  tick: number;
  players: Record<PlayerSeat, PlayerState>;
}

interface UIState {
  hoveredCoord: Coord | null;
}

interface BlobWarsInputState {
  game: BlobWarsSourceState;
  ui: UIState;
}

// Placeholder. Add cross-tile derived fields here (blob membership, aggregate
// stats, path overlays, etc.) and compute them in `deriveBlobWarsState`.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface DerivedState {}

type BlobWarsState = BlobWarsInputState & DerivedState;

interface TileData {
  coord: Coord;
  terrain: TileTerrain;
  owner: PlayerSeat | null;
  origin: TileOrigin | null;
  isPlaceable: boolean;
  isHovered: boolean;
}

export type {
  PlayerId,
  CoordKey,
  Coord,
  TileSource,
  BlobWarsSourceState,
  UIState,
  BlobWarsInputState,
  DerivedState,
  BlobWarsState,
  TileData,
};
