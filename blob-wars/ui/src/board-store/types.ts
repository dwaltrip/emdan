import type { MatchPhase, PlayerSeat, PlayerState, TileOrigin, TileState, TileTerrain } from '@shared/protocol';

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
  phase: MatchPhase;
  currentTurn: PlayerSeat | null;
  players: Record<PlayerSeat, PlayerState>;
}

interface UIState {
  hoveredCoord: Coord | null;
}

interface BlobWarsInputState {
  game: BlobWarsSourceState;
  ui: UIState;
}

interface DerivedState {
  excludedCoords: Map<CoordKey, Set<PlayerId>>;
}

type BlobWarsState = BlobWarsInputState & DerivedState;

type ExclusionSource = PlayerId | 'both' | null;

interface TileData {
  coord: Coord;
  terrain: TileTerrain;
  owner: PlayerSeat | null;
  origin: TileOrigin | null;
  isPlaceable: boolean;
  isHovered: boolean;
  insideExclusion: boolean;
  exclusionSource: ExclusionSource;
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
  ExclusionSource,
  TileData,
};
