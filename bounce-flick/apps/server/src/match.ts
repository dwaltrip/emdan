import type { PlayerSeat, ServerMessage } from '@shared/protocol'

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

  handleDisconnect(clientId: string): void {
    if (this.ended || !this.hasClient(clientId)) {
      return
    }

    this.ended = true
    this.send('player1', { type: 'match-ended', reason: 'disconnect' })
    this.send('player2', { type: 'match-ended', reason: 'disconnect' })
    this.onEnded()
  }
}
