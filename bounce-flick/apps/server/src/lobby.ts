import WebSocket from 'ws'

import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type ClientMessage,
  type GeneratedLevel,
  type PlayerSeat,
  type ServerMessage,
  serializeServerMessage,
} from '@shared/protocol'

import type { ClientConnection } from './connection'
import { Match } from './match'

// We are in prototype mode: server only runs a single match at a time.
// GlobalLobby orchestrates this match.
// Including pre-game level handshake:
//    - Player 1 (first to join the lobby) generates the level and sends to server.
//    - Once other players join, server sends them the agreed level.
//    - Any waiting player can press "Start now" once the level is ready.
export class GlobalLobby {
  private readonly clients = new Map<string, ClientConnection>()
  private readonly waitingPlayers: ClientConnection[] = []
  private pendingLevel: GeneratedLevel | null = null
  private readonly levelRecipients = new Set<string>()
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
      case 'start-now':
        this.handleStartNow(client)
        return
      case 'level-ready':
        this.handleLevelReady(clientId, message.level)
        return
      case 'game-level-received':
        this.handleGameLevelReceived(clientId)
        return
      case 'ball-update':
        if (this.activeMatch?.hasClient(clientId)) {
          this.activeMatch.handleBallUpdate(clientId, message.x, message.y)
        }
        return
      case 'player-finished':
        if (this.activeMatch?.hasClient(clientId)) {
          this.activeMatch.handleFinished(clientId, message.elapsedMs)
        }
        return
    }
  }

  private joinLobby(client: ClientConnection): void {
    if (this.activeMatch && !this.activeMatch.hasClient(client.id)) {
      this.sendError(client, 'match-in-progress', ' match already running. Try again later.')
      return
    }

    if (this.isWaiting(client.id)) {
      this.broadcastLobbyUpdate()
      return
    }

    if (this.waitingPlayers.length >= MAX_PLAYERS) {
      this.sendError(client, 'lobby-full', 'The lobby is full.')
      return
    }

    const seat = seatForIndex(this.waitingPlayers.length)
    this.waitingPlayers.push(client)

    this.send(client, { type: 'welcome', seat })

    if (seat === 'player1') {
      this.send(client, { type: 'generate-level-request' })
    }

    this.broadcastLobbyUpdate()

    this.maybeSendGameLevel()
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
    this.broadcastLobbyUpdate()
  }

  private maybeSendGameLevel(): void {
    const level = this.pendingLevel
    if (this.activeMatch || !level) {
      return
    }

    this.waitingPlayers.slice(1).forEach((player) => {
      if (this.levelRecipients.has(player.id)) {
        return
      }

      this.send(player, { type: 'game-level', level })
      this.levelRecipients.add(player.id)
    })
  }

  private handleGameLevelReceived(clientId: string): void {
    if (this.activeMatch || !this.isWaiting(clientId)) {
      return
    }

    this.broadcastLobbyUpdate()
  }

  private handleStartNow(client: ClientConnection): void {
    if (this.activeMatch) {
      this.sendError(client, 'match-in-progress', 'A match is already running.')
      return
    }

    if (!this.isWaiting(client.id)) {
      this.sendError(client, 'not-in-lobby', 'Join the lobby before starting a match.')
      return
    }

    if (!this.canStart()) {
      this.sendError(client, 'level-not-ready', 'The course is still being prepared.')
      return
    }

    this.startMatch()
  }

  private startMatch(): void {
    if (!this.canStart()) {
      return
    }

    this.maybeSendGameLevel()
    const players = [...this.waitingPlayers]
    this.waitingPlayers.length = 0
    this.pendingLevel = null
    this.levelRecipients.clear()

    const bySeat = new Map<PlayerSeat, ClientConnection>()
    const clientIds: Record<PlayerSeat, string> = {}

    players.forEach((player, index) => {
      const seat = seatForIndex(index)
      bySeat.set(seat, player)
      clientIds[seat] = player.id
    })

    this.activeMatch = new Match({
      clientIds,
      send: (seat, message) => {
        const player = bySeat.get(seat)
        if (!player) {
          return
        }

        const { socket } = player
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
      requiredPlayers: MIN_PLAYERS,
      ready: this.canStart(),
    }

    for (const player of this.waitingPlayers) {
      this.send(player, message)
    }
  }

  // A disconnect during setup aborts the whole pending lobby: drop everyone
  // and notify any partner, who must re-join. Keeps generated levels and seat
  // ordering from drifting apart while players are still assembling.
  private removeWaitingClient(clientId: string): void {
    const index = this.waitingPlayers.findIndex((player) => player.id === clientId)
    if (index === -1) {
      return
    }

    const partners = this.waitingPlayers.filter((player) => player.id !== clientId)
    this.waitingPlayers.length = 0
    this.pendingLevel = null
    this.levelRecipients.clear()

    for (const partner of partners) {
      this.send(partner, {
        type: 'match-ended',
        reason: 'disconnect',
        winner: null,
        times: {},
      })
    }
  }

  private canStart(): boolean {
    return this.waitingPlayers.length >= MIN_PLAYERS && this.pendingLevel !== null
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

function seatForIndex(index: number): PlayerSeat {
  return `player${index + 1}`
}
