import { describe, expect, it, vi } from 'vitest';

import type { ServerMessage } from '@shared/protocol';
import { Match, type MatchPlayer } from '../src/match';

function player(id: string, seat: number, messages: ServerMessage[]): MatchPlayer {
  return { id, seat, send: (message) => messages.push(message) };
}

describe('Match', () => {
  it('uses one server clock across every position update and retry', () => {
    let now = 1_000;
    const firstMessages: ServerMessage[] = [];
    const secondMessages: ServerMessage[] = [];
    const onEnded = vi.fn();
    const match = new Match({
      now: () => now,
      onEnded,
      players: [player('a', 1, firstMessages), player('b', 2, secondMessages)],
    });

    // Updates before and after a hypothetical client runtime restart do not
    // create or reset a Match clock.
    now = 4_000;
    match.handleBallUpdate('a', { x: 200, y: 300 });
    now = 8_000;
    match.handleBallUpdate('a', { x: 140, y: 300 });
    now = 11_000;
    match.handleFinished('a');
    now = 13_000;
    match.handleFinished('b');

    const ended = firstMessages.at(-1);
    expect(ended).toEqual({
      type: 'match-ended',
      outcome: {
        type: 'finished',
        times: [
          { elapsedMs: 10_000, seat: 1 },
          { elapsedMs: 12_000, seat: 2 },
        ],
        winner: 1,
      },
    });
    expect(secondMessages.at(-1)).toEqual(ended);
    expect(onEnded).toHaveBeenCalledOnce();
  });

  it('uses a separate outcome shape for disconnects', () => {
    const messages: ServerMessage[] = [];
    const match = new Match({
      onEnded: () => {},
      players: [player('a', 1, messages)],
    });

    match.handleDisconnect('a');

    expect(messages).toEqual([
      { type: 'match-ended', outcome: { type: 'aborted', reason: 'disconnect' } },
    ]);
  });
});
