import { describe, expect, it } from 'vitest';

import type { ServerMessage } from '@shared/protocol';
import type { ClientConnection } from '../src/connection';
import { GlobalLobby } from '../src/lobby';

function client(id: string) {
  const messages: ServerMessage[] = [];
  const connection: ClientConnection = { id, send: (message) => messages.push(message) };
  return { connection, messages };
}

describe('GlobalLobby', () => {
  it('assigns the seat and shared level in one match-started event', () => {
    const lobby = new GlobalLobby();
    const first = client('a');
    const second = client('b');
    lobby.addConnection(first.connection);
    lobby.addConnection(second.connection);
    lobby.handleClientMessage('a', { type: 'join-lobby' });
    lobby.handleClientMessage('b', { type: 'join-lobby' });

    lobby.handleClientMessage('a', { type: 'start-now' });

    const firstStart = first.messages.at(-1);
    const secondStart = second.messages.at(-1);
    expect(firstStart?.type).toBe('match-started');
    expect(secondStart?.type).toBe('match-started');
    if (firstStart?.type === 'match-started' && secondStart?.type === 'match-started') {
      expect(firstStart.seat).toBe(1);
      expect(secondStart.seat).toBe(2);
      expect(secondStart.level).toEqual(firstStart.level);
    }
  });

  it('keeps remaining waiting players in the lobby after a disconnect', () => {
    const lobby = new GlobalLobby();
    const first = client('a');
    const second = client('b');
    lobby.addConnection(first.connection);
    lobby.addConnection(second.connection);
    lobby.handleClientMessage('a', { type: 'join-lobby' });
    lobby.handleClientMessage('b', { type: 'join-lobby' });
    first.messages.length = 0;

    lobby.removeConnection('b');

    expect(first.messages).toEqual([{ type: 'lobby-update', canStart: true, playersConnected: 1 }]);
  });
});
