export type PlayerSeat = 'player1' | 'player2'
export type MatchEndReason = 'disconnect'

export const REQUIRED_PLAYERS = 2

// client -> server
export type ClientMessage = { type: 'joinLobby' }

// server -> client
export type ServerMessage =
  | { type: 'welcome'; seat: PlayerSeat }
  | { type: 'lobbyUpdate'; playersConnected: number; requiredPlayers: number; ready: boolean }
  | { type: 'matchStarted'; seat: PlayerSeat }
  | { type: 'matchEnded'; reason: MatchEndReason }
  | { type: 'error'; code: string; message: string }

export function serializeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message)
}

export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message)
}

export function parseClientMessage(raw: string): ClientMessage | null {
  const parsed = safeParse(raw)
  if (!isRecord(parsed) || typeof parsed.type !== 'string') {
    return null
  }

  switch (parsed.type) {
    case 'joinLobby':
      return { type: 'joinLobby' }
    default:
      return null
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  const parsed = safeParse(raw)
  if (!isRecord(parsed) || typeof parsed.type !== 'string') {
    return null
  }

  switch (parsed.type) {
    case 'welcome':
      return isSeat(parsed.seat) ? { type: 'welcome', seat: parsed.seat } : null
    case 'lobbyUpdate':
      if (
        typeof parsed.playersConnected !== 'number' ||
        typeof parsed.requiredPlayers !== 'number' ||
        typeof parsed.ready !== 'boolean'
      ) {
        return null
      }
      return {
        type: 'lobbyUpdate',
        playersConnected: parsed.playersConnected,
        requiredPlayers: parsed.requiredPlayers,
        ready: parsed.ready,
      }
    case 'matchStarted':
      return isSeat(parsed.seat) ? { type: 'matchStarted', seat: parsed.seat } : null
    case 'matchEnded':
      return parsed.reason === 'disconnect' ? { type: 'matchEnded', reason: 'disconnect' } : null
    case 'error':
      if (typeof parsed.code !== 'string' || typeof parsed.message !== 'string') {
        return null
      }
      return { type: 'error', code: parsed.code, message: parsed.message }
    default:
      return null
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSeat(value: unknown): value is PlayerSeat {
  return value === 'player1' || value === 'player2'
}
