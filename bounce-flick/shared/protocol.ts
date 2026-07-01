import type { GeneratedLevel, TerrainShape, TerrainSpec } from './level'

export type { GeneratedLevel } from './level'

export type PlayerSeat = `player${number}`
export type MatchEndReason = 'finished' | 'disconnect'
export type MatchWinner = PlayerSeat | 'draw'

export interface BallPosition {
  x: number
  y: number
}

export const MIN_PLAYERS = 1
export const MAX_PLAYERS = 8

// client -> server
export type ClientMessage =
  | { type: 'join-lobby' }
  | { type: 'start-now' }
  | { type: 'level-ready'; level: GeneratedLevel }
  | { type: 'game-level-received' }
  | { type: 'ball-update'; x: number; y: number }
  | { type: 'player-finished'; elapsedMs: number }

// server -> client
export type ServerMessage =
  | { type: 'welcome'; seat: PlayerSeat }
  | { type: 'lobby-update'; playersConnected: number; requiredPlayers: number; ready: boolean }
  | { type: 'generate-level-request' }
  | { type: 'game-level'; level: GeneratedLevel }
  | { type: 'start-game' }
  | { type: 'state-update'; positions: Record<PlayerSeat, BallPosition | null> }
  | {
      type: 'match-ended'
      reason: MatchEndReason
      winner: MatchWinner | null
      times: Record<PlayerSeat, number | null>
    }
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
    case 'join-lobby':
      return { type: 'join-lobby' }
    case 'start-now':
      return { type: 'start-now' }
    case 'level-ready':
      return isGeneratedLevel(parsed.level) ? { type: 'level-ready', level: parsed.level } : null
    case 'game-level-received':
      return { type: 'game-level-received' }
    case 'ball-update':
      return typeof parsed.x === 'number' && typeof parsed.y === 'number'
        ? { type: 'ball-update', x: parsed.x, y: parsed.y }
        : null
    case 'player-finished':
      return typeof parsed.elapsedMs === 'number'
        ? { type: 'player-finished', elapsedMs: parsed.elapsedMs }
        : null
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
    case 'lobby-update':
      if (
        typeof parsed.playersConnected !== 'number' ||
        typeof parsed.requiredPlayers !== 'number' ||
        typeof parsed.ready !== 'boolean'
      ) {
        return null
      }
      return {
        type: 'lobby-update',
        playersConnected: parsed.playersConnected,
        requiredPlayers: parsed.requiredPlayers,
        ready: parsed.ready,
      }
    case 'generate-level-request':
      return { type: 'generate-level-request' }
    case 'game-level':
      return isGeneratedLevel(parsed.level) ? { type: 'game-level', level: parsed.level } : null
    case 'start-game':
      return { type: 'start-game' }
    case 'state-update':
      return isPositions(parsed.positions)
        ? { type: 'state-update', positions: parsed.positions }
        : null
    case 'match-ended':
      if (
        !isMatchEndReason(parsed.reason) ||
        !isMatchWinnerOrNull(parsed.winner) ||
        !isTimes(parsed.times)
      ) {
        return null
      }
      return {
        type: 'match-ended',
        reason: parsed.reason,
        winner: parsed.winner,
        times: parsed.times,
      }
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
  return typeof value === 'string' && /^player[1-9]\d*$/.test(value)
}

function isBallPosition(value: unknown): value is BallPosition {
  return isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number'
}

function isPositions(value: unknown): value is Record<PlayerSeat, BallPosition | null> {
  return isRecord(value) && Object.entries(value).every(([seat, position]) => {
    return isSeat(seat) && (position === null || isBallPosition(position))
  })
}

function isMatchEndReason(value: unknown): value is MatchEndReason {
  return value === 'finished' || value === 'disconnect'
}

function isMatchWinnerOrNull(value: unknown): value is MatchWinner | null {
  return value === null || value === 'draw' || isSeat(value)
}

function isTimes(value: unknown): value is Record<PlayerSeat, number | null> {
  return isRecord(value) && Object.entries(value).every(([seat, time]) => {
    return isSeat(seat) && (time === null || typeof time === 'number')
  })
}

// Shallow validation: the level round-trips through JSON between our own
// client and server, so we check the top-level shape and each terrain entry's
// discriminants, not every nested field.
function isGeneratedLevel(value: unknown): value is GeneratedLevel {
  return (
    isRecord(value) &&
    typeof value.finishX === 'number' &&
    typeof value.startY === 'number' &&
    optionalNumber(value.finishPlatformIndex) &&
    optionalNumber(value.startPlatformIndex) &&
    Array.isArray(value.terrain) &&
    value.terrain.every(isTerrainSpec)
  )
}

function optionalNumber(value: unknown) {
  return value === undefined || typeof value === 'number'
}

function isTerrainSpec(value: unknown): value is TerrainSpec {
  return (
    isRecord(value) &&
    typeof value.deadly === 'boolean' &&
    (value.kind === 'wall' || value.kind === 'object' || value.kind === 'finish') &&
    isTerrainShape(value.shape) &&
    isRecord(value.style)
  )
}

function isTerrainShape(value: unknown): value is TerrainShape {
  return isRecord(value) && (value.type === 'rect' || value.type === 'polyline')
}
