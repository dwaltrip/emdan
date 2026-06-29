import type { BallPosition, PlayerSeat, ServerMessage } from '@shared/protocol'

interface MatchOptions {
  clientIds: Record<PlayerSeat, string>
  send: (seat: PlayerSeat, message: ServerMessage) => void
  onEnded: () => void
}

// The running game: owns the seat <-> client mapping and forfeit-on-disconnect.
// Created once the level handshake completes (see GlobalLobby). In-game gameplay
// relay (per-frame ball updates) is added in a follow-up.
export class Match {
  private readonly clientIds: Record<PlayerSeat, string>
  private readonly send: MatchOptions['send']
  private readonly onEnded: MatchOptions['onEnded']
  private readonly positions: Record<PlayerSeat, BallPosition | null> = {
    player1: null,
    player2: null,
  }
  private ended = false

  constructor(options: MatchOptions) {
    this.clientIds = options.clientIds
    this.send = options.send
    this.onEnded = options.onEnded
  }

  start(): void {
    this.send('player1', { type: 'start-game' })
    this.send('player2', { type: 'start-game' })
  }

  hasClient(clientId: string): boolean {
    return this.clientIds.player1 === clientId || this.clientIds.player2 === clientId
  }

  handleBallUpdate(clientId: string, x: number, y: number): void {
    if (this.ended) {
      return
    }

    const seat = this.seatOf(clientId)
    if (!seat) {
      return
    }

    this.positions[seat] = { x, y }
    this.broadcast()
  }

  handleDisconnect(clientId: string): void {
    if (this.ended || !this.hasClient(clientId)) {
      return
    }

    this.ended = true
    this.send('player1', { type: 'match-ended', reason: 'disconnect' })
    this.send('player2', { type: 'match-ended', reason: 'disconnect' })
    this.onEnded()
  }

  private broadcast(): void {
    const message: ServerMessage = { type: 'state-update', positions: this.positions }
    this.send('player1', message)
    this.send('player2', message)
  }

  private seatOf(clientId: string): PlayerSeat | null {
    if (this.clientIds.player1 === clientId) {
      return 'player1'
    }
    if (this.clientIds.player2 === clientId) {
      return 'player2'
    }
    return null
  }
}
