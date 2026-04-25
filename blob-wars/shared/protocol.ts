export const GRID_WIDTH = 120;
export const GRID_HEIGHT = 120;
export const TICK_INTERVAL_MS = 1000;
export const GROWTH_EVERY_TICKS = 1;
export const STARTING_SEEDS = 5;
export const SEED_EXCLUSION_RADIUS = 7;

export type PlayerSeat = "player1" | "player2";
export type MatchEndReason = "disconnect" | "boardFull";
export type MatchWinner = PlayerSeat | "draw";
export type MatchPhase = "placing" | "simulating" | "ended";
export type TileOrigin = "seed" | "spread";
export type TileTerrain = "blank" | "wall";

export interface TileState {
  terrain: TileTerrain;
  owner: PlayerSeat | null;
  origin: TileOrigin | null;
  plantedTick: number | null;
  lastGrowthTick: number | null;
}

export interface BoardState {
  width: number;
  height: number;
  tiles: TileState[][];
}

export interface PlayerState {
  connected: boolean;
  occupiedTiles: number;
  seedsRemaining: number;
}

export interface MatchSnapshot {
  matchId: string;
  tick: number;
  serverTimeMs: number;
  tickIntervalMs: number;
  growthEveryTicks: number;
  phase: MatchPhase;
  currentTurn: PlayerSeat | null;
  board: BoardState;
  players: Record<PlayerSeat, PlayerState>;
  currentUser: { seat: PlayerSeat | null };
}

export interface JoinLobbyMessage {
  type: "joinLobby";
}

export interface PlantSeedMessage {
  type: "plantSeed";
  x: number;
  y: number;
}

export interface PingMessage {
  type: "ping";
}

export type ClientMessage = JoinLobbyMessage | PlantSeedMessage | PingMessage;

export interface WelcomeMessage {
  type: "welcome";
  // TODO: use for pre-match "waiting for opponent" message, or remove.
  seat: PlayerSeat;
}

export interface LobbyUpdateMessage {
  type: "lobbyUpdate";
  playersConnected: number;
  requiredPlayers: number;
  ready: boolean;
}

export interface MatchStartedMessage {
  type: "matchStarted";
  seat: PlayerSeat;
  state: MatchSnapshot;
}

export interface StateUpdateMessage {
  type: "stateUpdate";
  state: MatchSnapshot;
}

export interface MatchEndedMessage {
  type: "matchEnded";
  reason: MatchEndReason;
  winner: MatchWinner;
  state: MatchSnapshot;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}

export type ServerMessage =
  | WelcomeMessage
  | LobbyUpdateMessage
  | MatchStartedMessage
  | StateUpdateMessage
  | MatchEndedMessage
  | ErrorMessage;

export function serializeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}

export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

export function parseClientMessage(raw: string): ClientMessage | null {
  const parsed = safeParse(raw);

  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    return null;
  }

  switch (parsed.type) {
    case "joinLobby":
      return { type: "joinLobby" };
    case "ping":
      return { type: "ping" };
    case "plantSeed":
      if (!Number.isInteger(parsed.x) || !Number.isInteger(parsed.y)) {
        return null;
      }

      return { type: "plantSeed", x: parsed.x as number, y: parsed.y as number };
    default:
      return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  const parsed = safeParse(raw);

  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    return null;
  }

  switch (parsed.type) {
    case "welcome":
      return isPlayerSeat(parsed.seat) ? { type: "welcome", seat: parsed.seat } : null;
    case "lobbyUpdate":
      if (
        typeof parsed.playersConnected !== "number" ||
        typeof parsed.requiredPlayers !== "number" ||
        typeof parsed.ready !== "boolean"
      ) {
        return null;
      }

      return {
        type: "lobbyUpdate",
        playersConnected: parsed.playersConnected,
        requiredPlayers: parsed.requiredPlayers,
        ready: parsed.ready,
      };
    case "matchStarted":
      if (!isPlayerSeat(parsed.seat) || !isMatchSnapshot(parsed.state)) {
        return null;
      }

      return {
        type: "matchStarted",
        seat: parsed.seat,
        state: parsed.state,
      };
    case "stateUpdate":
      return isMatchSnapshot(parsed.state)
        ? {
            type: "stateUpdate",
            state: parsed.state,
          }
        : null;
    case "matchEnded":
      if (
        !isMatchEndReason(parsed.reason) ||
        !isMatchWinner(parsed.winner) ||
        !isMatchSnapshot(parsed.state)
      ) {
        return null;
      }

      return {
        type: "matchEnded",
        reason: parsed.reason,
        winner: parsed.winner,
        state: parsed.state,
      };
    case "error":
      if (typeof parsed.code !== "string" || typeof parsed.message !== "string") {
        return null;
      }

      return {
        type: "error",
        code: parsed.code,
        message: parsed.message,
      };
    default:
      return null;
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isPlayerSeat(value: unknown): value is PlayerSeat {
  return value === "player1" || value === "player2";
}

function isMatchEndReason(value: unknown): value is MatchEndReason {
  return value === "disconnect" || value === "boardFull";
}

function isMatchWinner(value: unknown): value is MatchWinner {
  return value === "draw" || isPlayerSeat(value);
}

function isMatchSnapshot(value: unknown): value is MatchSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.matchId === "string" &&
    typeof value.tick === "number" &&
    typeof value.serverTimeMs === "number" &&
    typeof value.tickIntervalMs === "number" &&
    typeof value.growthEveryTicks === "number" &&
    isMatchPhase(value.phase) &&
    (value.currentTurn === null || isPlayerSeat(value.currentTurn)) &&
    isBoardState(value.board) &&
    isPlayersRecord(value.players) &&
    isCurrentUser(value.currentUser)
  );
}

function isCurrentUser(value: unknown): value is { seat: PlayerSeat | null } {
  return isRecord(value) && (value.seat === null || isPlayerSeat(value.seat));
}

function isMatchPhase(value: unknown): value is MatchPhase {
  return value === "placing" || value === "simulating" || value === "ended";
}

function isBoardState(value: unknown): value is BoardState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    Array.isArray(value.tiles) &&
    value.tiles.every((row) => Array.isArray(row) && row.every((tile) => isTileState(tile)))
  );
}

function isTileState(value: unknown): value is TileState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isTileTerrain(value.terrain) &&
    (value.owner === null || isPlayerSeat(value.owner)) &&
    isTileOriginOrNull(value.origin) &&
    isNumberOrNull(value.plantedTick) &&
    isNumberOrNull(value.lastGrowthTick)
  );
}

function isTileTerrain(value: unknown): value is TileTerrain {
  return value === "blank" || value === "wall";
}

function isPlayersRecord(value: unknown): value is Record<PlayerSeat, PlayerState> {
  if (!isRecord(value)) {
    return false;
  }

  return isPlayerState(value.player1) && isPlayerState(value.player2);
}

function isPlayerState(value: unknown): value is PlayerState {
  return (
    isRecord(value) &&
    typeof value.connected === "boolean" &&
    typeof value.occupiedTiles === "number" &&
    typeof value.seedsRemaining === "number"
  );
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isTileOriginOrNull(value: unknown): value is TileOrigin | null {
  return value === null || value === "seed" || value === "spread";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
