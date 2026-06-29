import { randomUUID } from 'node:crypto'

import WebSocket, { WebSocketServer, type RawData } from 'ws'

import { parseClientMessage, serializeServerMessage } from '@shared/protocol'

import { GlobalLobby } from './lobby'

const PORT = Number.parseInt(process.env.PORT ?? '3002', 10)
const lobby = new GlobalLobby()

const websocketServer = new WebSocketServer({ port: PORT })

websocketServer.on('connection', (socket) => {
  const client = {
    id: randomUUID(),
    socket,
  }

  lobby.addConnection(client)

  socket.on('message', (rawMessage: RawData) => {
    const message = parseClientMessage(normalizeRawMessage(rawMessage))
    if (!message) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          serializeServerMessage({
            type: 'error',
            code: 'invalid-message',
            message: 'Could not parse the websocket payload.',
          }),
        )
      }
      return
    }

    lobby.handleClientMessage(client.id, message)
  })

  socket.on('close', () => {
    lobby.removeConnection(client.id)
  })
})

websocketServer.on('listening', () => {
  console.log(`bounce-flick websocket server listening on :${PORT}`)
})

function normalizeRawMessage(rawMessage: RawData): string {
  if (typeof rawMessage === 'string') {
    return rawMessage
  }
  if (Buffer.isBuffer(rawMessage)) {
    return rawMessage.toString('utf8')
  }
  if (Array.isArray(rawMessage)) {
    return Buffer.concat(rawMessage).toString('utf8')
  }
  return Buffer.from(rawMessage).toString('utf8')
}
