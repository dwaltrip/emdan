import type WebSocket from "ws";

export interface ClientConnection {
  id: string;
  socket: WebSocket;
}
