import { addInkSegment, clampDrawingPoint } from './physics';
import { screenToWorld } from './view';
import type { Point, Runtime, ViewState } from './types';

type PublishHud = (force?: boolean) => void;

type KeyboardActions = {
  clearDrawings: () => void;
  eraseRecentInk: () => void;
};

export function bindKeyboardControls(view: ViewState, actions: KeyboardActions) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (isEditableEventTarget(event.target)) {
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      view.cameraFrozen = true;
      return;
    }

    if (isPlainKey(event, 'KeyC')) {
      event.preventDefault();
      actions.clearDrawings();
      return;
    }

    if (isPlainKey(event, 'KeyZ')) {
      event.preventDefault();
      actions.eraseRecentInk();
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.code !== 'Space') {
      return;
    }
    event.preventDefault();
    view.cameraFrozen = false;
  };
  const handleBlur = () => {
    view.cameraFrozen = false;
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleBlur);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleBlur);
  };
}

export function bindPointerControls(
  canvas: HTMLCanvasElement,
  runtime: Runtime,
  view: ViewState,
  publishHud: PublishHud,
) {
  let pointerId: number | null = null;
  let lastPointer: Point | null = null;
  let pointerScreen: Point | null = null;

  const cancelActiveStroke = () => {
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    pointerId = null;
    lastPointer = null;
    pointerScreen = null;
  };

  const extendStroke = (screenPoint: Point) => {
    if (!lastPointer) {
      return;
    }
    lastPointer = addInkSegment(
      runtime,
      lastPointer,
      clampDrawingPoint(screenToWorld(view, screenPoint)),
    );
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (runtime.phase !== 'running' || event.button !== 0) {
      return;
    }

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    pointerId = event.pointerId;
    pointerScreen = eventToCanvasPoint(canvas, event);
    lastPointer = clampDrawingPoint(screenToWorld(view, pointerScreen));
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    pointerScreen = eventToCanvasPoint(canvas, event);
    extendStroke(pointerScreen);
    publishHud(true);
  };

  const endPointer = (event: PointerEvent) => {
    if (pointerId === event.pointerId) {
      cancelActiveStroke();
    }
  };

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  return {
    cancelActiveStroke,
    isDrawing: () => pointerId !== null,
    syncAfterCameraMove: () => {
      if (pointerScreen) {
        extendStroke(pointerScreen);
      }
    },
    cleanup: () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
    },
  };
}

function eventToCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const bounds = canvas.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function isPlainKey(event: KeyboardEvent, code: string) {
  return event.code === code && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey;
}

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}
