type PlayerId = string;

type CoordKey = string;

interface Coord {
  x: number;
  y: number;
}

type TileType = 'empty' | 'seed' | 'grown';

interface TileSource {
  ownerPlayerId: PlayerId | null;
  type: 'seed' | 'grown' | null;
}

interface Player {
  id: PlayerId;
  index: number;
  lastPlacementTick: number;
}

type PlacementInput = { type: 'place'; coord: Coord } | { type: 'skip' };

interface BlobWarsSourceState {
  width: number;
  height: number;
  tiles: TileSource[][];
  tick: number;
  players: Player[];
  pendingPlacements: Record<PlayerId, PlacementInput>;
  status: 'active' | 'ended';
  winner: PlayerId | null;
}

interface UIState {
  hoveredCoord: Coord | null;
  activeInputPlayerId: PlayerId | null;
}

interface BlobWarsInputState {
  game: BlobWarsSourceState;
  ui: UIState;
}

type BlobId = number;

interface Blob {
  id: BlobId;
  ownerPlayerId: PlayerId;
  tiles: Coord[];
  seedCount: number;
  borderTiles: Coord[];
}

type GrowthDirection = 'positive' | 'neutral' | 'negative' | 'none';

interface DerivedState {
  blobs: Map<BlobId, Blob>;
  tileToBlobId: Map<CoordKey, BlobId>;
  ticksUntilPlacementByPlayer: Map<PlayerId, number>;
}

type BlobWarsState = BlobWarsInputState & DerivedState;

interface TileData {
  coord: Coord;
  ownerPlayerId: PlayerId | null;
  type: TileType;
  blobStrength: number;
  growthDirection: GrowthDirection;
  isPendingPlacement: boolean;
  pendingPlacementByPlayerId: PlayerId | null;
  isPlaceableForActiveInputPlayer: boolean;
  isHovered: boolean;
}

const PLACEMENT_COOLDOWN = 5;

export type {
  PlayerId,
  CoordKey,
  Coord,
  TileType,
  TileSource,
  Player,
  PlacementInput,
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
export { PLACEMENT_COOLDOWN };
