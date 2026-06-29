import type { BallPosition, GeneratedLevel, PlayerSeat, ServerMessage } from '@shared/protocol'

import { createGameSocket, type GameSocketHandle } from './game-socket'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface LobbyStatus {
  playersConnected: number
  requiredPlayers: number
  ready: boolean
}

export interface SessionState {
  status: ConnectionStatus
  seat: PlayerSeat | null
  lobby: LobbyStatus | null
  // The agreed level: generated locally (player 1) or received (player 2).
  level: GeneratedLevel | null
  started: boolean
}

// Non-reactive realtime channel: written by the message handler, read by the
// render loop. NOT part of SessionState — touching it never re-renders React.
export interface LiveState {
  opponent: BallPosition | null
}

export interface SessionDeps {
  generateLevel: () => GeneratedLevel
}

export interface Session {
  getState: () => SessionState
  subscribe: (listener: () => void) => () => void
  joinLobby: () => void
  end: () => void
  // realtime hot path (non-reactive)
  live: LiveState
  sendBall: (x: number, y: number) => void
}

export function createSession(url: string, deps: SessionDeps): Session {
  let state: SessionState = {
    status: 'connecting',
    seat: null,
    lobby: null,
    level: null,
    started: false,
  }
  const listeners = new Set<() => void>()
  const live: LiveState = { opponent: null }

  function otherSeat(): PlayerSeat | null {
    if (state.seat === 'player1') return 'player2'
    if (state.seat === 'player2') return 'player1'
    return null
  }

  function setState(patch: Partial<SessionState>): void {
    state = { ...state, ...patch }
    for (const listener of listeners) {
      listener()
    }
  }

  let socket: GameSocketHandle

  function handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        setState({ seat: message.seat })
        return
      case 'lobby-update':
        setState({
          lobby: {
            playersConnected: message.playersConnected,
            requiredPlayers: message.requiredPlayers,
            ready: message.ready,
          },
        })
        return
      case 'generate-level-request': {
        // Player 1: generate the level and send it back.
        const level = deps.generateLevel()
        setState({ level })
        socket.send({ type: 'level-ready', level })
        return
      }
      case 'game-level':
        // Player 2: adopt the level and acknowledge.
        setState({ level: message.level })
        socket.send({ type: 'game-level-received' })
        return
      case 'start-game':
        setState({ started: true })
        return
      case 'state-update': {
        // Hot path: bare assignment, no setState — never re-renders React.
        const other = otherSeat()
        live.opponent = other ? message.positions[other] : null
        return
      }
      case 'match-ended':
        live.opponent = null
        setState({ seat: null, lobby: null, level: null, started: false })
        return
      case 'error':
        console.warn('[session] server error', message.code, message.message)
        return
    }
  }

  socket = createGameSocket(url, {
    onOpen: () => setState({ status: 'connected' }),
    onClose: () => setState({ status: 'disconnected' }),
    onMessage: handleMessage,
  })

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    joinLobby: () => socket.send({ type: 'join-lobby' }),
    end: () => socket.close(),
    live,
    sendBall: (x, y) => socket.send({ type: 'ball-update', x, y }),
  }
}
