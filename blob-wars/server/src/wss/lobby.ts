import WebSocket from "ws";

import type { ClientConnection } from "./connection";
import { Match, type MatchId } from "@/game/match";
import {
  type ClientMessage,
  type ClientRole,
  type JoinLobbyMessage,
  type PlayerSeat,
  type ServerMessage,
  type WantOpponent,
  serializeServerMessage,
} from "@shared/protocol";

const BOT_TOKEN = process.env.BOT_TOKEN || "bot-token-secret--dummy-value";

interface MatchRecord {
  match: Match;
  clientIds: Record<PlayerSeat, string>;
  roles: Record<PlayerSeat, ClientRole>;
}

export class GlobalLobby {
  private readonly clients = new Map<string, ClientConnection>();
  private readonly connectionRoles = new Map<string, ClientRole>();
  private readonly humanQueue: ClientConnection[] = [];
  private readonly aiSeekers: ClientConnection[] = [];
  private readonly botPool: ClientConnection[] = [];
  private readonly matches = new Map<MatchId, MatchRecord>();
  private matchCounter = 0;

  addConnection(client: ClientConnection): void {
    this.clients.set(client.id, client);
  }

  removeConnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const matchRecord = this.findMatchByClient(clientId);
    if (matchRecord) {
      matchRecord.match.handleDisconnect(clientId);
    } else {
      this.removeFromQueues(clientId);
    }

    this.clients.delete(clientId);
    this.connectionRoles.delete(clientId);
  }

  handleClientMessage(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    if (message.type === "joinLobby") {
      this.joinLobby(client, message);
      return;
    }

    const matchRecord = this.findMatchByClient(clientId);
    if (matchRecord) {
      matchRecord.match.handleClientMessage(clientId, message);
      return;
    }

    if (this.isInAnyQueue(clientId)) {
      this.sendError(client, "match_not_started", "Wait for an opponent before sending game actions.");
      return;
    }

    this.sendError(client, "not_joined", "Join the lobby before sending game messages.");
  }

  private joinLobby(client: ClientConnection, message: JoinLobbyMessage): void {
    if (this.findMatchByClient(client.id) || this.isInAnyQueue(client.id)) {
      // Already joined — ignore.
      return;
    }

    if (message.role === "bot") {
      if (message.botToken !== BOT_TOKEN) {
        this.sendError(client, "bad_bot_token", "Invalid bot token.");
        client.socket.close();
        return;
      }
      this.connectionRoles.set(client.id, "bot");
      this.send(client, { type: "welcome", seat: "player1" });
      this.handleBotArrival(client);
      return;
    }

    // human
    const wantOpponent: WantOpponent = message.wantOpponent ?? "human";
    this.connectionRoles.set(client.id, "human");
    this.send(client, { type: "welcome", seat: "player1" });

    if (wantOpponent === "human") {
      this.handleHumanWantsHuman(client);
    } else {
      this.handleHumanWantsAi(client);
    }
  }

  private handleHumanWantsHuman(client: ClientConnection): void {
    const opponent = this.humanQueue.shift();
    if (opponent) {
      this.startMatch(
        { player1: opponent, player2: client },
        { player1: "human", player2: "human" },
      );
      return;
    }

    this.humanQueue.push(client);
    console.log(`[lobby] ${client.id} queued (humanQueue size=${this.humanQueue.length})`);
    this.send(client, { type: "lobbyUpdate", waitingFor: "human" });
  }

  private handleHumanWantsAi(client: ClientConnection): void {
    const bot = this.botPool.shift();
    if (bot) {
      this.startMatch(
        { player1: client, player2: bot },
        { player1: "human", player2: "bot" },
      );
      return;
    }

    this.aiSeekers.push(client);
    console.log(`[lobby] ${client.id} queued for AI (aiSeekers size=${this.aiSeekers.length})`);
    this.send(client, { type: "lobbyUpdate", waitingFor: "bot" });
  }

  private handleBotArrival(bot: ClientConnection): void {
    const seeker = this.aiSeekers.shift();
    if (seeker) {
      this.startMatch(
        { player1: seeker, player2: bot },
        { player1: "human", player2: "bot" },
      );
      return;
    }

    this.botPool.push(bot);
    console.log(`[lobby] bot ${bot.id} pooled (botPool size=${this.botPool.length})`);
    this.send(bot, { type: "lobbyUpdate", waitingFor: "human" });
  }

  private startMatch(
    seats: Record<PlayerSeat, ClientConnection>,
    roles: Record<PlayerSeat, ClientRole>,
  ): void {
    const id = this.nextMatchId();
    const clientIds: Record<PlayerSeat, string> = {
      player1: seats.player1.id,
      player2: seats.player2.id,
    };

    console.log(
      `[lobby] starting ${id}: player1=${clientIds.player1} (${roles.player1}), player2=${clientIds.player2} (${roles.player2})`,
    );

    const match = new Match({
      id,
      clientIds,
      roles,
      send: (seat, msg) => {
        const { socket } = seats[seat];
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(serializeServerMessage(msg));
      },
      isConnected: (seat) => seats[seat].socket.readyState === WebSocket.OPEN,
      onEnded: (matchId) => this.handleMatchEnded(matchId),
    });

    this.matches.set(id, { match, clientIds, roles });
    match.start();
  }

  private handleMatchEnded(matchId: MatchId): void {
    const record = this.matches.get(matchId);
    if (!record) return;

    this.matches.delete(matchId);

    // Recycle still-connected bots back into the pool, then try to pair them
    // with any waiting aiSeekers.
    for (const seat of ["player1", "player2"] as PlayerSeat[]) {
      if (record.roles[seat] !== "bot") continue;
      const clientId = record.clientIds[seat];
      const conn = this.clients.get(clientId);
      if (!conn) continue;
      if (conn.socket.readyState !== WebSocket.OPEN) continue;
      this.handleBotArrival(conn);
    }
  }

  private nextMatchId(): MatchId {
    this.matchCounter += 1;
    return `match-${formatTimestamp(new Date())}-${this.matchCounter}`;
  }

  private findMatchByClient(clientId: string): MatchRecord | undefined {
    for (const record of this.matches.values()) {
      if (record.match.hasClient(clientId)) return record;
    }
    return undefined;
  }

  private isInAnyQueue(clientId: string): boolean {
    return (
      this.humanQueue.some((c) => c.id === clientId) ||
      this.aiSeekers.some((c) => c.id === clientId) ||
      this.botPool.some((c) => c.id === clientId)
    );
  }

  private removeFromQueues(clientId: string): void {
    removeById(this.humanQueue, clientId);
    removeById(this.aiSeekers, clientId);
    removeById(this.botPool, clientId);
  }

  private send(client: ClientConnection, message: ServerMessage): void {
    if (client.socket.readyState !== WebSocket.OPEN) return;
    client.socket.send(serializeServerMessage(message));
  }

  private sendError(client: ClientConnection, code: string, message: string): void {
    this.send(client, { type: "error", code, message });
  }
}

function removeById(queue: ClientConnection[], clientId: string): void {
  const idx = queue.findIndex((c) => c.id === clientId);
  if (idx !== -1) queue.splice(idx, 1);
}

function formatTimestamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}.${hh}.${mi}.${ss}`;
}
