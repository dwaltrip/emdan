import { useLayoutEffect, useRef } from 'react';

import type { Session } from '@/session/session';

import './board-canvas.css';
import { init } from './renderer';

interface BoardCanvasProps {
  session: Session;
  width: number;
  height: number;
}

export function BoardCanvas({ session, width, height }: BoardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    return init(canvas, container, session.store, session, width, height);
  }, [session, width, height]);

  return (
    <div ref={containerRef} className="board-canvas-container">
      <canvas ref={canvasRef} className="board-canvas" />
    </div>
  );
}
