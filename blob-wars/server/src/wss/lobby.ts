import WebSocket from "ws";

import type { AssignedClientConnection, ClientConnection } from "./connection.ts";
import { Match } from "../game/match.ts";
import {
  type ClientMessage,
  type PlayerSeat,
  type ServerMessage,
  serializeServerMessage,
} from "../../../shared/protocol.ts";

export class GlobalLobby {
  private readonly clients = new Map<string, ClientConnection>();
  private readonly waitingPlayers: AssignedClientConnection[] = [];
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

    if (this.isWaiting(clientId)) {
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

    if (this.isWaiting(client.id)) {
      this.broadcastLobbyUpdate();
      return;
    }

    if (this.waitingPlayers.length >= 2) {
      this.sendError(client, "lobby_full", "The prototype lobby is full.");
      return;
    }

    const seat: PlayerSeat = this.waitingPlayers.length === 0 ? "player1" : "player2";
    client.seat = seat;
    this.waitingPlayers.push(client as AssignedClientConnection);

    this.send(client, { type: "welcome", seat });

    this.broadcastLobbyUpdate();

    if (this.waitingPlayers.length === 2) {
      this.startMatch();
    }
  }

  private startMatch(): void {
    const [player1, player2] = this.waitingPlayers;
    if (!player1 || !player2) {
      return;
    }

    this.waitingPlayers.length = 0;
    const bySeat: Record<PlayerSeat, AssignedClientConnection> = { player1, player2 };
    this.activeMatch = new Match({
      clientIds: { player1: player1.id, player2: player2.id },
      send: (seat, message) => {
        const { socket } = bySeat[seat];
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }
        socket.send(serializeServerMessage(message));
      },
      isConnected: (seat) => bySeat[seat].socket.readyState === WebSocket.OPEN,
      onEnded: () => {
        const c1 = this.clients.get(player1.id);
        const c2 = this.clients.get(player2.id);
        if (c1) c1.seat = null;
        if (c2) c2.seat = null;
        this.activeMatch = null;
      },
    });
    this.activeMatch.start();
  }

  private broadcastLobbyUpdate(): void {
    const message = {
      type: "lobbyUpdate" as const,
      playersConnected: this.waitingPlayers.length,
      requiredPlayers: 2,
      ready: this.waitingPlayers.length === 2,
    };

    for (const player of this.waitingPlayers) {
      this.send(player, message);
    }
  }

  private removeWaitingClient(clientId: string): void {
    const index = this.waitingPlayers.findIndex((p) => p.id === clientId);
    if (index === -1) {
      return;
    }

    this.waitingPlayers.splice(index, 1);
    this.broadcastLobbyUpdate();
  }

  private isWaiting(clientId: string): boolean {
    return this.waitingPlayers.some((p) => p.id === clientId);
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
