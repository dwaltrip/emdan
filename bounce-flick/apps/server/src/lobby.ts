import WebSocket from 'ws'

import {
  REQUIRED_PLAYERS,
  type ClientMessage,
  type PlayerSeat,
  type ServerMessage,
  serializeServerMessage,
} from '@shared/protocol'

import type { ClientConnection } from './connection'
import { Match } from './match'

export class GlobalLobby {
  private readonly clients = new Map<string, ClientConnection>()
  private readonly waitingPlayers: ClientConnection[] = []
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

    if (message.type === 'joinLobby') {
      this.joinLobby(client)
      return
    }

    // In-match gameplay messages (ball updates) will be routed to the active
    // match here in the ball-update follow-up.
  }

  private joinLobby(client: ClientConnection): void {
    if (this.activeMatch && !this.activeMatch.hasClient(client.id)) {
      this.sendError(client, 'match_in_progress', 'A match is already running. Try again when it ends.')
      return
    }

    if (this.isWaiting(client.id)) {
      this.broadcastLobbyUpdate()
      return
    }

    if (this.waitingPlayers.length >= REQUIRED_PLAYERS) {
      this.sendError(client, 'lobby_full', 'The lobby is full.')
      return
    }

    const seat: PlayerSeat = this.waitingPlayers.length === 0 ? 'player1' : 'player2'
    this.waitingPlayers.push(client)

    this.send(client, { type: 'welcome', seat })
    this.broadcastLobbyUpdate()

    if (this.waitingPlayers.length === REQUIRED_PLAYERS) {
      this.startMatch()
    }
  }

  private startMatch(): void {
    const [player1, player2] = this.waitingPlayers
    if (!player1 || !player2) {
      return
    }

    this.waitingPlayers.length = 0
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
      type: 'lobbyUpdate',
      playersConnected: this.waitingPlayers.length,
      requiredPlayers: REQUIRED_PLAYERS,
      ready: this.waitingPlayers.length === REQUIRED_PLAYERS,
    }

    for (const player of this.waitingPlayers) {
      this.send(player, message)
    }
  }

  private removeWaitingClient(clientId: string): void {
    const index = this.waitingPlayers.findIndex((player) => player.id === clientId)
    if (index === -1) {
      return
    }

    this.waitingPlayers.splice(index, 1)
    this.broadcastLobbyUpdate()
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
