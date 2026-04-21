export const GRID_WIDTH = 12;
export const GRID_HEIGHT = 12;
export const TICK_INTERVAL_MS = 100;
export const GROWTH_EVERY_TICKS = 10;

export type PlayerSeat = "player1" | "player2";
export type MatchEndReason = "disconnect" | "boardFull";
export type MatchWinner = PlayerSeat | "draw";

export interface TileState {
  owner: PlayerSeat | null;
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
}

export interface MatchSnapshot {
  matchId: string;
  tick: number;
  serverTimeMs: number;
  tickIntervalMs: number;
  growthEveryTicks: number;
  board: BoardState;
  players: Record<PlayerSeat, PlayerState>;
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

export function serializeMessage(message: ServerMessage): string {
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
      if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
        return null;
      }

      return { type: "plantSeed", x: parsed.x, y: parsed.y };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
