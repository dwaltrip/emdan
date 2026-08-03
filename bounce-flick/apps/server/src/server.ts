import { randomUUID } from 'node:crypto';
import WebSocket, { WebSocketServer, type RawData } from 'ws';

import type { ServerMessage } from '@shared/protocol';
import { parseClientMessage } from './client-message';
import type { ClientConnection } from './connection';
import { GlobalLobby } from './lobby';

function initServer(websocketServer: WebSocketServer) {
  const lobby = new GlobalLobby();

  websocketServer.on('connection', (socket) => {
    const client: ClientConnection = {
      id: randomUUID(),
      send: (message: ServerMessage) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message));
        }
      },
    };

    lobby.addConnection(client);

    socket.on('message', (rawMessage: RawData) => {
      const message = parseClientMessage(normalizeRawMessage(rawMessage));
      if (!message) {
        client.send({
          type: 'error',
          code: 'invalid-message',
          message: 'Could not parse the websocket payload.',
        });
        return;
      }

      lobby.handleClientMessage(client.id, message);
    });

    socket.on('close', () => {
      lobby.removeConnection(client.id);
    });
  });
}

function normalizeRawMessage(rawMessage: RawData): string {
  if (typeof rawMessage === 'string') {
    return rawMessage;
  }
  if (Buffer.isBuffer(rawMessage)) {
    return rawMessage.toString('utf8');
  }
  if (Array.isArray(rawMessage)) {
    return Buffer.concat(rawMessage).toString('utf8');
  }
  return Buffer.from(rawMessage).toString('utf8');
}

export { initServer };
