import type { PlayerSeat, ServerMessage } from '@shared/protocol'

import { createGameSocket } from './game-socket'

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
}

export interface Session {
  getState: () => SessionState
  subscribe: (listener: () => void) => () => void
  joinLobby: () => void
  end: () => void
}

export function createSession(url: string): Session {
  let state: SessionState = {
    status: 'connecting',
    seat: null,
    lobby: null,
  }
  const listeners = new Set<() => void>()

  function setState(patch: Partial<SessionState>): void {
    state = { ...state, ...patch }
    for (const listener of listeners) {
      listener()
    }
  }

  function handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        // Seated in the queue; still waiting for an opponent to join.
        return
      case 'lobbyUpdate':
        setState({
          lobby: {
            playersConnected: message.playersConnected,
            requiredPlayers: message.requiredPlayers,
            ready: message.ready,
          },
        })
        return
      case 'matchStarted':
        setState({ seat: message.seat, lobby: null })
        return
      case 'matchEnded':
        setState({ seat: null })
        return
      case 'error':
        console.warn('[session] server error', message.code, message.message)
        return
    }
  }

  const socket = createGameSocket(url, {
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
    joinLobby: () => socket.send({ type: 'joinLobby' }),
    end: () => socket.close(),
  }
}
