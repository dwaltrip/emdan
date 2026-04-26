// Imperative core of the canvas board renderer. No React imports below this
// line — `init` / `destroy` is the React boundary.
//
// applySnapshot-is-sync contract: step 2 (synchronous first paint) requires
// that store.getTileData returns populated data at init time. This holds
// because actions.applySnapshot runs synchronously in the WebSocket handler:
// it mutates state, runs runPipeline (populating tileCache), and only then
// notifies subscribers — including useMatchId, which triggers the React
// render that mounts us. If applySnapshot ever becomes async (worker,
// microtask batch), step 2 must handle empty cache (paint on first notify,
// or await populated state).
//
// destroy() responsibilities (mirror this when adding new resources to init):
//   - cancelAnimationFrame(rafId) and null the id
//   - call store unsubscribe
//   - remove all pointer listeners on the canvas
//   - disconnect ResizeObserver
//   - remove matchMedia change listener (and don't re-arm)
//   - clear hover state

import type { BoardStoreInstance, Coord } from '@/board-store';
import { perfLog } from '@/lib/perf-log';
import type { Session } from '@/session/session';

import { pixelToTile } from './coords';
import { drawAllTiles, drawHoverRing } from './draw';
import { createPulseEffect } from './effects/seed-pulse';
import { describeInteraction } from './interaction';
import { computeLayout, observeContainer, observeDpr, type LayoutState } from './layout';
import { theme } from './theme';

function init(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  store: BoardStoreInstance,
  session: Session,
  width: number,
  height: number,
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[board-canvas] 2D context unavailable');

  let layout: LayoutState = computeLayout(container, width, height);
  const tileLayer = new OffscreenCanvas(layout.backingWidth, layout.backingHeight);
  const tileLayerCtx = tileLayer.getContext('2d');
  if (!tileLayerCtx) throw new Error('[board-canvas] tile layer 2D context unavailable');

  // TODO: revisit this abstraction if more layers arrive or layout complexity
  // grows further — likely extract per-surface apply helpers into layout.ts at
  // that point.
  function applyLayoutToSurfaces(): void {
    canvas.width = layout.backingWidth;
    canvas.height = layout.backingHeight;
    canvas.style.width = `${layout.backingWidth / layout.dpr}px`;
    canvas.style.height = `${layout.backingHeight / layout.dpr}px`;
    tileLayer.width = layout.backingWidth;
    tileLayer.height = layout.backingHeight;
  }
  applyLayoutToSurfaces();

  let tilesDirty = true;
  let frameDirty = true;
  let rafId: number | null = null;

  // State for the indicator pass. Hover today; exclusion-radius preview etc.
  // in Phase 2. Consumed by describeInteraction → cursor + drawHoverRing.
  const hoverState: { coord: Coord | null } = { coord: null };

  const pulse = createPulseEffect();
  let prevTick = store.state.game.tick;

  function scheduleFrame(): void {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(renderFrame);
  }

  function requestTilesRedraw(): void {
    tilesDirty = true;
    frameDirty = true;
    scheduleFrame();
  }

  function requestComposite(): void {
    frameDirty = true;
    scheduleFrame();
  }

  function renderFrame(): void {
    rafId = null;
    const now = performance.now();
    const animating = pulse.isActive(now);
    if (!tilesDirty && !frameDirty && !animating) return;

    if (tilesDirty) {
      const tick = store.state.game.tick;
      perfLog.timed('canvasDraw', tick, () =>
        drawAllTiles(tileLayerCtx!, store, theme, layout),
      );
      tilesDirty = false;
    }

    // Composite: blit tile layer, then pure effects, then time effects.
    ctx!.drawImage(tileLayer, 0, 0);
    const interaction = describeInteraction(hoverState.coord, store, session);
    canvas.style.cursor = interaction.kind === 'placeable' ? 'pointer' : 'default';
    drawHoverRing(ctx!, hoverState.coord, interaction, theme, layout);
    pulse.draw(ctx!, store, theme, layout, now);

    perfLog.rAFEvent('paint', store.state.game.tick);
    frameDirty = false;
    if (animating) scheduleFrame();
  }

  // Step 2: synchronous first paint (relies on the contract above).
  renderFrame();

  // Step 3: store subscription.
  // Slice-of-state-change pattern: diffing a slice (tick) across notifies fires
  // a renderer-local effect. Examples that fit: capture flare on owner flip,
  // phase-change transitions. Inline diffing today (N=1); extract a
  // `watchSlice(getter, onChange)` helper only when N grows or predicates get
  // complex.
  const unsubStore = store.subscribe(() => {
    const { phase, tick } = store.state.game;
    if (phase === 'simulating' && tick !== prevTick) {
      pulse.trigger(performance.now());
    }
    prevTick = tick;
    requestTilesRedraw();
  });

  // Step 4: pointer handlers.
  function onPointerMove(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    const next = pixelToTile(rect, e.clientX, e.clientY, width, height);
    if (
      hoverState.coord === null ||
      hoverState.coord.x !== next.x ||
      hoverState.coord.y !== next.y
    ) {
      hoverState.coord = next;
      requestComposite();
    }
  }
  function onPointerLeave(): void {
    if (hoverState.coord !== null) {
      hoverState.coord = null;
      requestComposite();
    }
  }
  function onClick(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const coord = pixelToTile(rect, e.clientX, e.clientY, width, height);
    const interaction = describeInteraction(coord, store, session);
    if (interaction.kind === 'placeable') {
      session.plant(coord.x, coord.y);
    }
  }
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('click', onClick);

  // Step 5: container size + DPR observers.
  function relayout(): void {
    layout = computeLayout(container, width, height);
    applyLayoutToSurfaces();
    requestTilesRedraw();
  }
  const unobserveContainer = observeContainer(container, relayout);
  const unobserveDpr = observeDpr(relayout);

  return function destroy(): void {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    unsubStore();
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('click', onClick);
    unobserveContainer();
    unobserveDpr();
    hoverState.coord = null;
  };
}

export { init };
