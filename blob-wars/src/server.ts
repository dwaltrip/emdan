import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

import WebSocket, { WebSocketServer } from "ws";

import { GlobalLobby } from "./lobby.ts";
import { parseClientMessage, serializeMessage } from "./protocol.ts";

export interface RunningServer {
  close: () => Promise<void>;
}

export function startServer(port = getPort()): RunningServer {
  const lobby = new GlobalLobby();

  const server = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        service: "blob-wars-websocket",
        health: "/health",
      }),
    );
  });

  const websocketServer = new WebSocketServer({ server });

  websocketServer.on("connection", (socket) => {
    const client = {
      id: randomUUID(),
      socket,
      seat: null,
    };

    lobby.addConnection(client);

    socket.on("message", (rawMessage) => {
      const parsedMessage = parseClientMessage(normalizeRawMessage(rawMessage));

      if (!parsedMessage) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(
            serializeMessage({
              type: "error",
              code: "invalid_message",
              message: "Could not parse the websocket payload.",
            }),
          );
        }
        return;
      }

      lobby.handleClientMessage(client.id, parsedMessage);
    });

    socket.on("close", () => {
      lobby.removeConnection(client.id);
    });
  });

  server.listen(port, () => {
    console.log(`Blob Wars websocket server listening on http://localhost:${port}`);
  });

  return {
    close: async () =>
      new Promise<void>((resolve, reject) => {
        websocketServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          server.close((serverError) => {
            if (serverError) {
              reject(serverError);
              return;
            }

            resolve();
          });
        });
      }),
  };
}

function getPort(): number {
  const parsedPort = Number.parseInt(process.env.PORT ?? "3002", 10);
  return Number.isNaN(parsedPort) ? 3002 : parsedPort;
}

function normalizeRawMessage(rawMessage: WebSocket.RawData): string {
  if (typeof rawMessage === "string") {
    return rawMessage;
  }

  if (Buffer.isBuffer(rawMessage)) {
    return rawMessage.toString("utf8");
  }

  if (Array.isArray(rawMessage)) {
    return Buffer.concat(rawMessage).toString("utf8");
  }

  return Buffer.from(rawMessage).toString("utf8");
}
