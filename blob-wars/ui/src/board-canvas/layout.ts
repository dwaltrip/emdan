interface LayoutState {
  cellDevicePx: number;
  gutter: number;
  dpr: number;
  backingWidth: number;
  backingHeight: number;
}

function applyLayout(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  gridWidth: number,
  gridHeight: number,
): LayoutState {
  const dpr = window.devicePixelRatio || 1;
  const cellDevicePx = Math.min(
    Math.floor((container.clientWidth * dpr) / gridWidth),
    Math.floor((container.clientHeight * dpr) / gridHeight),
  );
  const backingWidth = cellDevicePx * gridWidth;
  const backingHeight = cellDevicePx * gridHeight;

  canvas.width = backingWidth;
  canvas.height = backingHeight;
  canvas.style.width = `${backingWidth / dpr}px`;
  canvas.style.height = `${backingHeight / dpr}px`;

  return {
    cellDevicePx,
    gutter: Math.round(dpr),
    dpr,
    backingWidth,
    backingHeight,
  };
}

function observeContainer(container: HTMLElement, onChange: () => void): () => void {
  const ro = new ResizeObserver(() => onChange());
  ro.observe(container);
  return () => ro.disconnect();
}

// matchMedia listener is parameterized by the current DPR; re-arm at the new
// DPR after each fire so subsequent zooms continue to relayout.
function observeDpr(onChange: () => void): () => void {
  let mq: MediaQueryList | null = null;
  let listener: (() => void) | null = null;
  let disposed = false;

  function arm(): void {
    if (disposed) return;
    const dpr = window.devicePixelRatio || 1;
    mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    listener = () => {
      if (mq && listener) mq.removeEventListener('change', listener);
      onChange();
      arm();
    };
    mq.addEventListener('change', listener);
  }
  arm();

  return () => {
    disposed = true;
    if (mq && listener) mq.removeEventListener('change', listener);
  };
}

export type { LayoutState };
export { applyLayout, observeContainer, observeDpr };
