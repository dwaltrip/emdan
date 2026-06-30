import { WebSocketServer } from 'ws'

import { initServer } from './server'


const PORT = Number.parseInt(process.env.PORT ?? '3002', 10)
const websocketServer = new WebSocketServer({ port: PORT })

websocketServer.on('listening', () => {
  console.log(`bounce-flick websocket server listening on :${PORT}`)
})

initServer(websocketServer)
