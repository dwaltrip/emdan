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
  private readonly seats: PlayerSeat[]
  private readonly positions: Record<PlayerSeat, BallPosition | null> = {}
  private readonly finishTimes: Record<PlayerSeat, number | null> = {}
  private ended = false

  constructor(options: MatchOptions) {
    this.clientIds = options.clientIds
    this.send = options.send
    this.onEnded = options.onEnded
    this.seats = Object.keys(options.clientIds) as PlayerSeat[]
    this.seats.forEach((seat) => {
      this.positions[seat] = null
      this.finishTimes[seat] = null
    })
  }

  start(): void {
    this.seats.forEach((seat) => {
      this.send(seat, { type: 'start-game' })
    })
  }

  hasClient(clientId: string): boolean {
    return Object.values(this.clientIds).includes(clientId)
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

    // Wait for every participant to finish, then compare times.
    if (this.seats.every((playerSeat) => typeof this.finishTimes[playerSeat] === 'number')) {
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
    this.seats.forEach((seat) => {
      this.send(seat, message)
    })
    this.onEnded()
  }

  private decideWinner(): MatchWinner {
    let winningSeat: PlayerSeat | null = null
    let winningTime = Number.POSITIVE_INFINITY
    let tied = false

    this.seats.forEach((seat) => {
      const time = this.finishTimes[seat]
      if (time === null || time === undefined) {
        return
      }

      if (time < winningTime) {
        winningSeat = seat
        winningTime = time
        tied = false
        return
      }

      if (time === winningTime) {
        tied = true
      }
    })

    if (!winningSeat || tied) {
      return 'draw'
    }

    return winningSeat
  }

  private broadcast(): void {
    const message: ServerMessage = { type: 'state-update', positions: this.positions }
    this.seats.forEach((seat) => {
      this.send(seat, message)
    })
  }

  private seatOf(clientId: string): PlayerSeat | null {
    for (const [seat, seatClientId] of Object.entries(this.clientIds)) {
      if (seatClientId === clientId) {
        return seat as PlayerSeat
      }
    }

    return null
  }
}
