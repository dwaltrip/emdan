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
import { describeInteraction } from './interaction';
import { applyLayout, observeContainer, observeDpr, type LayoutState } from './layout';
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

  let layout: LayoutState = applyLayout(canvas, container, width, height);
  let dirty = true;
  let rafId: number | null = null;

  // State for the indicator pass. Hover today; exclusion-radius preview etc.
  // in Phase 2. Consumed by describeInteraction → cursor + drawHoverRing.
  const hoverState: { coord: Coord | null } = { coord: null };

  function scheduleFrame(): void {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(frame);
  }

  // Public "I changed something, please redraw" wrapper. Phase 2's continuous
  // rAF will call scheduleFrame() directly from inside frame() (no re-mark)
  // to keep the loop alive while an animation is in flight.
  function requestRender(): void {
    dirty = true;
    scheduleFrame();
  }

  function frame(): void {
    rafId = null;
    if (!dirty) return;

    const interaction = describeInteraction(hoverState.coord, store, session);
    canvas.style.cursor = interaction.kind === 'placeable' ? 'pointer' : 'default';

    const tick = store.state.game.tick;
    perfLog.timed('canvasDraw', tick, () => drawAllTiles(ctx!, store, theme, layout));
    drawHoverRing(ctx!, hoverState.coord, interaction, theme, layout);
    perfLog.rAFEvent('paint', tick);

    dirty = false;
  }

  // Step 2: synchronous first paint (relies on the contract above).
  frame();

  // Step 3: store subscription.
  const unsubStore = store.subscribe(() => {
    requestRender();
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
      requestRender();
    }
  }
  function onPointerLeave(): void {
    if (hoverState.coord !== null) {
      hoverState.coord = null;
      requestRender();
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
    layout = applyLayout(canvas, container, width, height);
    requestRender();
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
