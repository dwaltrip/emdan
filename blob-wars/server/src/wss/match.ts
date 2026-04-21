import WebSocket from "ws";

import {
  GROWTH_EVERY_TICKS,
  GRID_HEIGHT,
  GRID_WIDTH,
  TICK_INTERVAL_MS,
  type ClientMessage,
  type MatchEndReason,
  type MatchSnapshot,
  type MatchWinner,
  type PlayerSeat,
  type ServerMessage,
  serializeServerMessage,
} from "../../../shared/protocol.ts";

export interface ClientConnection {
  id: string;
  socket: WebSocket;
  seat: PlayerSeat | null;
}

export interface AssignedClientConnection extends ClientConnection {
  seat: PlayerSeat;
}

interface Tile {
  owner: PlayerSeat | null;
  plantedTick: number | null;
  lastGrowthTick: number | null;
}

interface QueuedAction {
  clientId: string;
  seat: PlayerSeat;
  x: number;
  y: number;
}

interface MatchOptions {
  onEnded: (players: ClientConnection[]) => void;
}

export class Match {
  readonly id: string;

  private readonly players: Record<PlayerSeat, AssignedClientConnection>;
  private readonly onEnded: MatchOptions["onEnded"];
  private readonly board: Tile[][];
  private readonly startedAt = Date.now();
  private readonly queuedActions: QueuedAction[] = [];
  private tickNumber = 0;
  private timer: NodeJS.Timeout | null = null;
  private ended = false;

  constructor(player1: AssignedClientConnection, player2: AssignedClientConnection, options: MatchOptions) {
    this.id = `match-${Date.now()}`;
    this.players = {
      player1,
      player2,
    };
    this.onEnded = options.onEnded;
    this.board = createBoard();
  }

  start(): void {
    const snapshot = this.getSnapshot();

    this.sendToAll((seat) => ({
      type: "matchStarted",
      seat,
      state: snapshot,
    }));

    this.timer = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);
  }

  hasClient(clientId: string): boolean {
    return this.players.player1.id === clientId || this.players.player2.id === clientId;
  }

  handleClientMessage(clientId: string, message: Exclude<ClientMessage, { type: "joinLobby" }>): void {
    if (this.ended) {
      return;
    }

    const player = this.getPlayerById(clientId);
    if (!player) {
      return;
    }

    if (message.type === "ping") {
      return;
    }

    if (!Number.isInteger(message.x) || !Number.isInteger(message.y)) {
      this.sendError(player, "invalid_coordinates", "Seed coordinates must be integers.");
      return;
    }

    if (!isInsideBoard(message.x, message.y)) {
      this.sendError(player, "out_of_bounds", "Seed coordinates are outside the board.");
      return;
    }

    this.queuedActions.push({
      clientId,
      seat: player.seat,
      x: message.x,
      y: message.y,
    });
  }

  handleDisconnect(clientId: string): void {
    if (this.ended) {
      return;
    }

    const player = this.getPlayerById(clientId);
    if (!player) {
      return;
    }

    const winner = otherSeat(player.seat);
    this.finish("disconnect", winner);
  }

  private tick(): void {
    if (this.ended) {
      return;
    }

    this.tickNumber += 1;
    this.applyQueuedActions();

    if (this.tickNumber % GROWTH_EVERY_TICKS === 0) {
      this.expandSeeds();
    }

    const snapshot = this.getSnapshot();
    this.sendToAll({
      type: "stateUpdate",
      state: snapshot,
    });

    if (isBoardFull(this.board)) {
      this.finish("boardFull", determineWinner(snapshot));
    }
  }

  private applyQueuedActions(): void {
    for (const action of this.queuedActions.splice(0)) {
      const player = this.getPlayerById(action.clientId);
      if (!player || player.seat !== action.seat) {
        continue;
      }

      const tile = this.board[action.y]?.[action.x];
      if (!tile) {
        continue;
      }

      if (tile.owner !== null) {
        this.sendError(player, "tile_occupied", "That tile is already occupied.");
        continue;
      }

      tile.owner = action.seat;
      tile.plantedTick = this.tickNumber;
      tile.lastGrowthTick = this.tickNumber;
    }
  }

  private expandSeeds(): void {
    const claims = new Map<string, Set<PlayerSeat>>();

    for (let y = 0; y < this.board.length; y += 1) {
      for (let x = 0; x < this.board[y]!.length; x += 1) {
        const tile = this.board[y]![x]!;

        if (tile.owner === null || tile.lastGrowthTick === null) {
          continue;
        }

        if (this.tickNumber - tile.lastGrowthTick < GROWTH_EVERY_TICKS) {
          continue;
        }

        tile.lastGrowthTick = this.tickNumber;

        for (const [nextX, nextY] of getNeighborCoordinates(x, y)) {
          const target = this.board[nextY]?.[nextX];
          if (!target || target.owner !== null) {
            continue;
          }

          const key = `${nextX},${nextY}`;
          const owners = claims.get(key) ?? new Set<PlayerSeat>();
          owners.add(tile.owner);
          claims.set(key, owners);
        }
      }
    }

    for (const [key, owners] of claims) {
      if (owners.size !== 1) {
        continue;
      }

      const [xText, yText] = key.split(",");
      const x = Number.parseInt(xText ?? "", 10);
      const y = Number.parseInt(yText ?? "", 10);
      const tile = this.board[y]?.[x];
      if (Number.isNaN(x) || Number.isNaN(y) || !tile || tile.owner !== null) {
        continue;
      }

      const [owner] = owners;
      if (!owner) {
        continue;
      }

      tile.owner = owner;
      tile.plantedTick = this.tickNumber;
      tile.lastGrowthTick = this.tickNumber;
    }
  }

  private finish(reason: MatchEndReason, winner: MatchWinner): void {
    if (this.ended) {
      return;
    }

    this.ended = true;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const snapshot = this.getSnapshot();
    this.sendToAll({
      type: "matchEnded",
      reason,
      winner,
      state: snapshot,
    });

    this.onEnded([this.players.player1, this.players.player2]);
  }

  private getSnapshot(): MatchSnapshot {
    const counts = countTiles(this.board);

    return {
      matchId: this.id,
      tick: this.tickNumber,
      serverTimeMs: Date.now() - this.startedAt,
      tickIntervalMs: TICK_INTERVAL_MS,
      growthEveryTicks: GROWTH_EVERY_TICKS,
      board: {
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
        tiles: this.board.map((row) => row.map((tile) => ({ ...tile }))),
      },
      players: {
        player1: {
          connected: this.players.player1.socket.readyState === WebSocket.OPEN,
          occupiedTiles: counts.player1,
        },
        player2: {
          connected: this.players.player2.socket.readyState === WebSocket.OPEN,
          occupiedTiles: counts.player2,
        },
      },
    };
  }

  private sendToAll(message: ServerMessage | ((seat: PlayerSeat) => ServerMessage)): void {
    this.send(this.players.player1, typeof message === "function" ? message("player1") : message);
    this.send(this.players.player2, typeof message === "function" ? message("player2") : message);
  }

  private send(player: AssignedClientConnection, message: ServerMessage): void {
    if (player.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    player.socket.send(serializeServerMessage(message));
  }

  private sendError(player: AssignedClientConnection, code: string, message: string): void {
    this.send(player, {
      type: "error",
      code,
      message,
    });
  }

  private getPlayerById(clientId: string): AssignedClientConnection | null {
    if (this.players.player1.id === clientId) {
      return this.players.player1;
    }

    if (this.players.player2.id === clientId) {
      return this.players.player2;
    }

    return null;
  }
}

function createBoard(): Tile[][] {
  return Array.from({ length: GRID_HEIGHT }, () =>
    Array.from({ length: GRID_WIDTH }, () => ({
      owner: null,
      plantedTick: null,
      lastGrowthTick: null,
    })),
  );
}

function countTiles(board: Tile[][]): Record<PlayerSeat, number> {
  const counts: Record<PlayerSeat, number> = {
    player1: 0,
    player2: 0,
  };

  for (const row of board) {
    for (const tile of row) {
      if (tile.owner) {
        counts[tile.owner] += 1;
      }
    }
  }

  return counts;
}

function isBoardFull(board: Tile[][]): boolean {
  return board.every((row) => row.every((tile) => tile.owner !== null));
}

function determineWinner(snapshot: MatchSnapshot): MatchWinner {
  const player1Count = snapshot.players.player1.occupiedTiles;
  const player2Count = snapshot.players.player2.occupiedTiles;

  if (player1Count === player2Count) {
    return "draw";
  }

  return player1Count > player2Count ? "player1" : "player2";
}

function otherSeat(seat: PlayerSeat): PlayerSeat {
  return seat === "player1" ? "player2" : "player1";
}

function isInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}

function getNeighborCoordinates(x: number, y: number): Array<[number, number]> {
  const neighbors: Array<[number, number]> = [];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const nextX = x + dx;
      const nextY = y + dy;

      if (isInsideBoard(nextX, nextY)) {
        neighbors.push([nextX, nextY]);
      }
    }
  }

  return neighbors;
}
