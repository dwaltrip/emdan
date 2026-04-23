import WebSocket from "ws";

import type { AssignedClientConnection, ClientConnection } from "./connection.ts";
import { Match } from "../game/match.ts";
import type { MatchTransport } from "../game/transport.ts";
import {
  type ClientMessage,
  type PlayerSeat,
  type ServerMessage,
  serializeServerMessage,
} from "../../../shared/protocol.ts";

export class GlobalLobby {
  private readonly clients = new Map<string, ClientConnection>();
  private readonly waitingClientIds: string[] = [];
  private activeMatch: Match | null = null;

  addConnection(client: ClientConnection): void {
    this.clients.set(client.id, client);
  }

  removeConnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    if (this.activeMatch?.hasClient(clientId)) {
      this.activeMatch.handleDisconnect(clientId);
    } else {
      this.removeWaitingClient(clientId);
    }

    client.seat = null;
    this.clients.delete(clientId);
  }

  handleClientMessage(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    if (message.type === "joinLobby") {
      this.joinLobby(client);
      return;
    }

    if (this.activeMatch?.hasClient(clientId)) {
      this.activeMatch.handleClientMessage(clientId, message);
      return;
    }

    if (this.waitingClientIds.includes(clientId)) {
      this.sendError(client, "match_not_started", "Wait for a second player before sending game actions.");
      return;
    }

    this.sendError(client, "not_joined", "Join the lobby before sending game messages.");
  }

  private joinLobby(client: ClientConnection): void {
    if (this.activeMatch && !this.activeMatch.hasClient(client.id)) {
      this.sendError(client, "match_in_progress", "A match is already running. Try again when it ends.");
      return;
    }

    if (this.waitingClientIds.includes(client.id)) {
      this.broadcastLobbyUpdate();
      return;
    }

    if (this.waitingClientIds.length >= 2) {
      this.sendError(client, "lobby_full", "The prototype lobby is full.");
      return;
    }

    const seat = this.waitingClientIds.length === 0 ? "player1" : "player2";
    client.seat = seat;
    this.waitingClientIds.push(client.id);

    this.send(client, {
      type: "welcome",
      seat,
    });

    this.broadcastLobbyUpdate();

    if (this.waitingClientIds.length === 2) {
      this.startMatch();
    }
  }

  private startMatch(): void {
    const [player1Id, player2Id] = this.waitingClientIds;
    const player1 = player1Id ? this.clients.get(player1Id) : null;
    const player2 = player2Id ? this.clients.get(player2Id) : null;

    if (!isAssignedSeat(player1, "player1") || !isAssignedSeat(player2, "player2")) {
      return;
    }

    this.waitingClientIds.length = 0;
    const p1: ClientConnection = player1;
    const p2: ClientConnection = player2;
    this.activeMatch = new Match({
      clientIds: { player1: player1.id, player2: player2.id },
      transport: createMatchTransport(player1, player2),
      onEnded: () => {
        p1.seat = null;
        p2.seat = null;
        this.activeMatch = null;
      },
    });
    this.activeMatch.start();
  }

  private broadcastLobbyUpdate(): void {
    const message = {
      type: "lobbyUpdate" as const,
      playersConnected: this.waitingClientIds.length,
      requiredPlayers: 2,
      ready: this.waitingClientIds.length === 2,
    };

    for (const clientId of this.waitingClientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        this.send(client, message);
      }
    }
  }

  private removeWaitingClient(clientId: string): void {
    const index = this.waitingClientIds.indexOf(clientId);
    if (index === -1) {
      return;
    }

    this.waitingClientIds.splice(index, 1);
    this.broadcastLobbyUpdate();
  }

  private send(client: ClientConnection, message: ServerMessage): void {
    if (client.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    client.socket.send(serializeServerMessage(message));
  }

  private sendError(client: ClientConnection, code: string, message: string): void {
    this.send(client, {
      type: "error",
      code,
      message,
    });
  }
}

function isAssignedSeat(
  client: ClientConnection | null | undefined,
  seat: AssignedClientConnection["seat"],
): client is AssignedClientConnection {
  return client !== null && client !== undefined && client.seat === seat;
}

function createMatchTransport(
  player1: AssignedClientConnection,
  player2: AssignedClientConnection,
): MatchTransport {
  const bySeat: Record<PlayerSeat, AssignedClientConnection> = { player1, player2 };
  return {
    send(seat, message) {
      const { socket } = bySeat[seat];
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(serializeServerMessage(message));
    },
    isConnected(seat) {
      return bySeat[seat].socket.readyState === WebSocket.OPEN;
    },
  };
}
