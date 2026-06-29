import type { BallPosition, MatchWinner, PlayerSeat, ServerMessage } from '@shared/protocol'

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
  private readonly finishTimes: Record<PlayerSeat, number | null> = {
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

  handleFinished(clientId: string, elapsedMs: number): void {
    if (this.ended) {
      return
    }

    const seat = this.seatOf(clientId)
    if (!seat || this.finishTimes[seat] !== null) {
      return
    }

    this.finishTimes[seat] = elapsedMs

    // Wait for both to finish, then compare times.
    if (this.finishTimes.player1 !== null && this.finishTimes.player2 !== null) {
      this.finish('finished', this.decideWinner())
    }
  }

  handleDisconnect(clientId: string): void {
    if (this.ended || !this.hasClient(clientId)) {
      return
    }

    this.finish('disconnect', null)
  }

  private finish(reason: 'finished' | 'disconnect', winner: MatchWinner | null): void {
    if (this.ended) {
      return
    }

    this.ended = true
    const message: ServerMessage = {
      type: 'match-ended',
      reason,
      winner,
      times: this.finishTimes,
    }
    this.send('player1', message)
    this.send('player2', message)
    this.onEnded()
  }

  private decideWinner(): MatchWinner {
    const p1 = this.finishTimes.player1
    const p2 = this.finishTimes.player2
    if (p1 === null || p2 === null || p1 === p2) {
      return 'draw'
    }
    return p1 < p2 ? 'player1' : 'player2'
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
