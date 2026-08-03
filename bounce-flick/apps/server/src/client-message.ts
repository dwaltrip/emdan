import type { ClientMessage } from '@shared/protocol';
import { z } from 'zod';

const clientMessageSchema: z.ZodType<ClientMessage> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join-lobby') }).strict(),
  z.object({ type: z.literal('start-now') }).strict(),
  z
    .object({
      type: z.literal('ball-update'),
      position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
    })
    .strict(),
  z.object({ type: z.literal('player-finished') }).strict(),
]);

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const result = clientMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
