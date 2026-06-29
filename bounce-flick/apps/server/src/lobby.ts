import WebSocket from 'ws'

import {
  REQUIRED_PLAYERS,
  type ClientMessage,
  type GeneratedLevel,
  type PlayerSeat,
  type ServerMessage,
  serializeServerMessage,
} from '@shared/protocol'

import type { ClientConnection } from './connection'
import { Match } from './match'

// Single-active-match lobby. It also owns the pre-game level handshake:
// player 1 (first joiner) generates the level while player 2 is still arriving;
// once both are seated and the level is in hand, the server hands it to player 2
// and starts the match on their ack.
export class GlobalLobby {
  private readonly clients = new Map<string, ClientConnection>()
  private readonly waitingPlayers: ClientConnection[] = []
  private pendingLevel: GeneratedLevel | null = null
  private gameLevelSent = false
  private activeMatch: Match | null = null

  addConnection(client: ClientConnection): void {
    this.clients.set(client.id, client)
  }

  removeConnection(clientId: string): void {
    const client = this.clients.get(clientId)
    if (!client) {
      return
    }

    if (this.activeMatch?.hasClient(clientId)) {
      this.activeMatch.handleDisconnect(clientId)
    } else {
      this.removeWaitingClient(clientId)
    }

    this.clients.delete(clientId)
  }

  handleClientMessage(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId)
    if (!client) {
      return
    }

    switch (message.type) {
      case 'join-lobby':
        this.joinLobby(client)
        return
      case 'level-ready':
        this.handleLevelReady(clientId, message.level)
        return
      case 'game-level-received':
        this.handleGameLevelReceived(clientId)
        return
    }

    // In-game messages (ball updates) will be routed to the active match here
    // in the ball-update follow-up.
  }

  private joinLobby(client: ClientConnection): void {
    if (this.activeMatch && !this.activeMatch.hasClient(client.id)) {
      this.sendError(client, 'match-in-progress', 'A match is already running. Try again when it ends.')
      return
    }

    if (this.isWaiting(client.id)) {
      this.broadcastLobbyUpdate()
      return
    }

    if (this.waitingPlayers.length >= REQUIRED_PLAYERS) {
      this.sendError(client, 'lobby-full', 'The lobby is full.')
      return
    }

    const seat: PlayerSeat = this.waitingPlayers.length === 0 ? 'player1' : 'player2'
    this.waitingPlayers.push(client)

    this.send(client, { type: 'welcome', seat })

    if (seat === 'player1') {
      this.send(client, { type: 'generate-level-request' })
    }

    this.broadcastLobbyUpdate()

    if (seat === 'player2') {
      this.maybeSendGameLevel()
    }
  }

  private handleLevelReady(clientId: string, level: GeneratedLevel): void {
    if (this.activeMatch || this.pendingLevel) {
      return
    }

    const generator = this.waitingPlayers[0]
    if (!generator || generator.id !== clientId) {
      return
    }

    this.pendingLevel = level
    this.maybeSendGameLevel()
  }

  private maybeSendGameLevel(): void {
    if (this.activeMatch || this.gameLevelSent || !this.pendingLevel) {
      return
    }

    const player2 = this.waitingPlayers[1]
    if (!player2) {
      return
    }

    this.send(player2, { type: 'game-level', level: this.pendingLevel })
    this.gameLevelSent = true
  }

  private handleGameLevelReceived(clientId: string): void {
    if (this.activeMatch || !this.gameLevelSent) {
      return
    }

    const player2 = this.waitingPlayers[1]
    if (!player2 || player2.id !== clientId) {
      return
    }

    this.startMatch()
  }

  private startMatch(): void {
    const [player1, player2] = this.waitingPlayers
    if (!player1 || !player2) {
      return
    }

    this.waitingPlayers.length = 0
    this.pendingLevel = null
    this.gameLevelSent = false

    const bySeat: Record<PlayerSeat, ClientConnection> = { player1, player2 }
    this.activeMatch = new Match({
      clientIds: { player1: player1.id, player2: player2.id },
      send: (seat, message) => {
        const { socket } = bySeat[seat]
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(serializeServerMessage(message))
        }
      },
      onEnded: () => {
        this.activeMatch = null
      },
    })
    this.activeMatch.start()
  }

  private broadcastLobbyUpdate(): void {
    const message: ServerMessage = {
      type: 'lobby-update',
      playersConnected: this.waitingPlayers.length,
      requiredPlayers: REQUIRED_PLAYERS,
      ready: this.waitingPlayers.length === REQUIRED_PLAYERS,
    }

    for (const player of this.waitingPlayers) {
      this.send(player, message)
    }
  }

  // A disconnect during setup aborts the whole pending pairing: drop everyone
  // and notify any partner, who must re-join. Keeps the player1/player2 seat
  // ordering valid (the queue is always [], [p1], or [p1, p2]).
  private removeWaitingClient(clientId: string): void {
    const index = this.waitingPlayers.findIndex((player) => player.id === clientId)
    if (index === -1) {
      return
    }

    const partners = this.waitingPlayers.filter((player) => player.id !== clientId)
    this.waitingPlayers.length = 0
    this.pendingLevel = null
    this.gameLevelSent = false

    for (const partner of partners) {
      this.send(partner, { type: 'match-ended', reason: 'disconnect' })
    }
  }

  private isWaiting(clientId: string): boolean {
    return this.waitingPlayers.some((player) => player.id === clientId)
  }

  private send(client: ClientConnection, message: ServerMessage): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(serializeServerMessage(message))
    }
  }

  private sendError(client: ClientConnection, code: string, message: string): void {
    this.send(client, { type: 'error', code, message })
  }
}
