import type WebSocket from "ws";

import type { PlayerSeat } from "../../../shared/protocol.ts";

export interface ClientConnection {
  id: string;
  socket: WebSocket;
  seat: PlayerSeat | null;
}

export interface AssignedClientConnection extends ClientConnection {
  seat: PlayerSeat;
}
