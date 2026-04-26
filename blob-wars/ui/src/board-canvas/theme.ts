import type { PlayerSeat } from '@shared/protocol';

import type { ExclusionSource } from '@/board-store';

interface SeatPalette {
  base: string;
  hoverBorder: string;
  hoverGlow: string;
}

const SEAT_COLORS: Record<PlayerSeat, SeatPalette> = {
  player1: {
    base: '#613fb0',
    hoverBorder: '#b89cff',
    hoverGlow: 'rgba(184, 156, 255, 0.45)',
  },
  player2: {
    base: '#226e3e',
    hoverBorder: '#6fd095',
    hoverGlow: 'rgba(111, 208, 149, 0.45)',
  },
};

const EXCLUSION_TINTS: Record<Exclude<ExclusionSource, null>, string> = {
  player1: 'rgba(97, 63, 176, 0.28)',
  player2: 'rgba(34, 110, 62, 0.32)',
  both: 'rgba(140, 140, 160, 0.24)',
};

const theme = {
  // Drawn under tiles to provide the inter-tile gutter color. Matches the
  // page bg (index.css `body { background-color: #111827 }`).
  GUTTER_COLOR: '#111827',

  TILE_EMPTY_FILL: 'rgba(71, 75, 81, 0.59)',
  WALL_FILL: '#1f2937',
  WALL_STROKE: '#111827',
  ORIGIN_SEED_DOT: 'rgba(255, 255, 255, 0.92)',

  SEAT_COLORS,
  EXCLUSION_TINTS,
};

type Theme = typeof theme;

export type { Theme, SeatPalette };
export { theme };
