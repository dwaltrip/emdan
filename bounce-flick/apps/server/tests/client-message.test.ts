import { describe, expect, it } from 'vitest';

import { parseClientMessage } from '../src/client-message';

describe('client message validation', () => {
  it('accepts the semantic position command', () => {
    expect(
      parseClientMessage(JSON.stringify({ type: 'ball-update', position: { x: 12, y: 34 } })),
    ).toEqual({ type: 'ball-update', position: { x: 12, y: 34 } });
  });

  it('rejects legacy and client-timed finish payloads', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'ball-update', x: 12, y: 34 }))).toBeNull();
    expect(
      parseClientMessage(JSON.stringify({ type: 'player-finished', elapsedMs: 1000 })),
    ).toBeNull();
  });

  it('rejects malformed JSON and extra command fields', () => {
    expect(parseClientMessage('{')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'start-now', surprise: true }))).toBeNull();
  });
});
