import type { PlayerSeat, ServerMessage } from "../../../shared/protocol.ts";

export interface MatchTransport {
  send(seat: PlayerSeat, message: ServerMessage): void;
  isConnected(seat: PlayerSeat): boolean;
}
