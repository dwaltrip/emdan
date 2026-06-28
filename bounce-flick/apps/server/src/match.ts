import type { PlayerSeat, ServerMessage } from '@shared/protocol'

interface MatchOptions {
  clientIds: Record<PlayerSeat, string>
  send: (seat: PlayerSeat, message: ServerMessage) => void
  onEnded: () => void
}

// Matchmaking shell: owns the seat <-> client mapping and the match lifecycle.
// In-match gameplay relay (per-frame ball updates) is added in a follow-up.
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
    this.send('player1', { type: 'matchStarted', seat: 'player1' })
    this.send('player2', { type: 'matchStarted', seat: 'player2' })
  }

  hasClient(clientId: string): boolean {
    return this.clientIds.player1 === clientId || this.clientIds.player2 === clientId
  }

  handleDisconnect(clientId: string): void {
    if (this.ended || !this.hasClient(clientId)) {
      return
    }

    this.ended = true
    this.send('player1', { type: 'matchEnded', reason: 'disconnect' })
    this.send('player2', { type: 'matchEnded', reason: 'disconnect' })
    this.onEnded()
  }
}
