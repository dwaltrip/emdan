import type { ServerMessage } from '@shared/protocol';

// Transport-neutral connection used by the lobby and match domain.
export interface ClientConnection {
  id: string;
  send: (message: ServerMessage) => void;
}
