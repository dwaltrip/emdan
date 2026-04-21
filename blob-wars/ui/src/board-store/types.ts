import type { PlayerSeat, PlayerState, TileOrigin, TileState } from '../../../shared/protocol';

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

type BlobId = number;

interface Blob {
  id: BlobId;
  owner: PlayerSeat;
  tiles: Coord[];
  seedCount: number;
  borderTiles: Coord[];
}

type GrowthDirection = 'positive' | 'neutral' | 'negative' | 'none';

interface DerivedState {
  blobs: Map<BlobId, Blob>;
  tileToBlobId: Map<CoordKey, BlobId>;
}

type BlobWarsState = BlobWarsInputState & DerivedState;

interface TileData {
  coord: Coord;
  owner: PlayerSeat | null;
  origin: TileOrigin | null;
  blobStrength: number;
  growthDirection: GrowthDirection;
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
  BlobId,
  Blob,
  GrowthDirection,
  DerivedState,
  BlobWarsState,
  TileData,
};
