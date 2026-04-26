// Time effect: heartbeat pulse on each simulation tick.
//
// First module implementing the time-effect interface (trigger / isActive /
// draw). Validate the shape at N=2 (next time effect — capture flare etc.);
// copy-paste before abstracting. No animation manager, no registry.
//
// Single-timestamp boundary: per-seed timestamps would only matter at
// (mid-sim instance changes) ∧ (overlap-aware visuals). Neither holds today —
// seeds are frozen during the 'simulating' phase, so the global timestamp
// truncates uniformly across all seeds when a new tick lands.
//
// See also: entity pass becomes the natural home when per-instance TTL state
// is unavoidable (capture flares, projectiles).

import type { BoardStoreInstance } from '@/board-store';

import { tileCenter } from '../coords';
import type { LayoutState } from '../layout';
import type { Theme } from '../theme';

// alt curves to explore: cubic-bezier expansion, additive blend on rapid ticks,
// ring-stroke variant, per-seat asymmetric curves.
const PULSE_DURATION_MS = 400;
const PULSE_MAX_RADIUS_MULT = 2.0;
const SEED_DOT_RADIUS_MULT = 0.15;

interface TimeEffect {
  trigger(now: number): void;
  isActive(now: number): boolean;
  draw(
    ctx: CanvasRenderingContext2D,
    store: BoardStoreInstance,
    theme: Theme,
    layout: LayoutState,
    now: number,
  ): void;
}

// No dispose needed: state is a single primitive (`pulseStart`) in this closure.
// If a future time effect holds rAF/listeners/timers, grow the interface with
// `dispose()` and have renderer's `destroy()` walk them.
function createPulseEffect(): TimeEffect {
  let pulseStart: number | null = null;

  return {
    trigger(now) {
      pulseStart = now;
    },
    isActive(now) {
      return pulseStart !== null && now - pulseStart < PULSE_DURATION_MS;
    },
    draw(ctx, store, theme, layout, now) {
      if (pulseStart === null) return;
      const p = (now - pulseStart) / PULSE_DURATION_MS;
      if (p >= 1) return;

      const eased = 1 - (1 - p) ** 2; // radius: fast start, slow end
      const alpha = (1 - p) ** 2; // opacity: faster decay than radius
      const radius =
        layout.cellDevicePx *
        (SEED_DOT_RADIUS_MULT + eased * (PULSE_MAX_RADIUS_MULT - SEED_DOT_RADIUS_MULT));

      for (const { coord, owner } of store.derived.seeds) {
        const { cx, cy } = tileCenter(coord.x, coord.y, layout.cellDevicePx);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = theme.SEAT_COLORS[owner].pulseFill;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
  };
}

export type { TimeEffect };
export { createPulseEffect };
