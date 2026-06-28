import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

import WebSocket, { WebSocketServer, type RawData } from 'ws'

import { parseClientMessage, serializeServerMessage } from '@shared/protocol'

import { GlobalLobby } from './lobby'

const PORT = Number.parseInt(process.env.PORT ?? '3002', 10)
const lobby = new GlobalLobby()

const httpServer = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ service: 'bounce-flick-ws' }))
})

const websocketServer = new WebSocketServer({ server: httpServer })

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
            code: 'invalid_message',
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

httpServer.listen(PORT, () => {
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
