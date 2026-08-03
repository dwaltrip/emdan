import type { ClientMessage, ServerErrorCode, ServerMessage } from '@shared/protocol';

import type { ClientConnection } from './connection';
import { generateLevel } from './generate-level';
import { Match, type MatchPlayer } from './match';

const MIN_PLAYERS = 1;
const MAX_PLAYERS = 8;

// Prototype coordinator for one waiting room and one active match. Seats and
// the level are assigned atomically when the match starts.
export class GlobalLobby {
  private activeMatch: Match | null = null;
  private readonly clients = new Map<string, ClientConnection>();
  private readonly waitingPlayers: ClientConnection[] = [];

  addConnection(client: ClientConnection): void {
    this.clients.set(client.id, client);
  }

  removeConnection(clientId: string): void {
    if (!this.clients.has(clientId)) {
      return;
    }

    if (this.activeMatch?.hasClient(clientId)) {
      this.activeMatch.handleDisconnect(clientId);
    } else {
      const index = this.waitingPlayers.findIndex((player) => player.id === clientId);
      if (index !== -1) {
        this.waitingPlayers.splice(index, 1);
        this.broadcastLobbyUpdate();
      }
    }

    this.clients.delete(clientId);
  }

  handleClientMessage(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    switch (message.type) {
      case 'join-lobby':
        this.joinLobby(client);
        return;
      case 'start-now':
        this.handleStartNow(client);
        return;
      case 'ball-update':
        this.activeMatch?.handleBallUpdate(clientId, message.position);
        return;
      case 'player-finished':
        this.activeMatch?.handleFinished(clientId);
        return;
    }
  }

  private joinLobby(client: ClientConnection): void {
    if (this.activeMatch) {
      this.sendError(client, 'match-in-progress', 'A match is already running. Try again later.');
      return;
    }

    if (this.waitingPlayers.some((player) => player.id === client.id)) {
      this.broadcastLobbyUpdate();
      return;
    }

    if (this.waitingPlayers.length >= MAX_PLAYERS) {
      this.sendError(client, 'lobby-full', 'The lobby is full.');
      return;
    }

    this.waitingPlayers.push(client);
    this.broadcastLobbyUpdate();
  }

  private handleStartNow(client: ClientConnection): void {
    if (this.activeMatch) {
      this.sendError(client, 'match-in-progress', 'A match is already running.');
      return;
    }

    if (!this.waitingPlayers.some((player) => player.id === client.id)) {
      this.sendError(client, 'not-in-lobby', 'Join the lobby before starting a match.');
      return;
    }

    if (this.waitingPlayers.length >= MIN_PLAYERS) {
      this.startMatch();
    }
  }

  private startMatch(): void {
    const level = generateLevel();
    const players: MatchPlayer[] = this.waitingPlayers.map((player, index) => ({
      id: player.id,
      seat: index + 1,
      send: player.send,
    }));
    this.waitingPlayers.length = 0;

    const match = new Match({
      players,
      onEnded: () => {
        if (this.activeMatch === match) {
          this.activeMatch = null;
        }
      },
    });
    this.activeMatch = match;

    players.forEach((player) => {
      player.send({ type: 'match-started', level, seat: player.seat });
    });
  }

  private broadcastLobbyUpdate(): void {
    const message: ServerMessage = {
      type: 'lobby-update',
      canStart: this.waitingPlayers.length >= MIN_PLAYERS,
      playersConnected: this.waitingPlayers.length,
    };
    this.waitingPlayers.forEach((player) => player.send(message));
  }

  private sendError(client: ClientConnection, code: ServerErrorCode, message: string): void {
    client.send({ type: 'error', code, message });
  }
}
