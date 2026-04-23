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
  excludedCoords: Set<CoordKey>;
}

type BlobWarsState = BlobWarsInputState & DerivedState;

interface TileData {
  coord: Coord;
  terrain: TileTerrain;
  owner: PlayerSeat | null;
  origin: TileOrigin | null;
  isPlaceable: boolean;
  isHovered: boolean;
  insideExclusion: boolean;
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
