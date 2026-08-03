import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { INITIAL_HUD } from '../game/constants';
import type { GameActions, GeneratedLevel } from '../game/types';
import { useBounceFlickGame } from '../hooks/useBounceFlickGame';
import { session } from '../net/session-instance';
import { GameHeader } from './GameHeader';
import { GameStage } from './GameStage';

const AUTO_RESTART_DELAY_MS = 600;

export function Game({ level }: { level: GeneratedLevel }) {
  const [runKey, setRunKey] = useState(0);
  const [levelStartedAt] = useState(() => performance.now());
  const restart = useCallback(() => setRunKey((key) => key + 1), []);

  return (
    <GameRun
      key={runKey}
      level={level}
      levelStartedAt={levelStartedAt}
      onRestart={restart}
    />
  );
}

function GameRun({
  level,
  levelStartedAt,
  onRestart,
}: {
  level: GeneratedLevel;
  levelStartedAt: number;
  onRestart: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const actionsRef = useRef<GameActions | null>(null);
  const [hud, setHud] = useState(INITIAL_HUD);

  // Stable per mount so it doesn't retrigger the game-loop effect.
  // `session.live` is non-React game state, safe to read in the callback.
  // TODO(dan): Find a better API for giving live multiplayer state to game loop.
  const net = useMemo(
    () => ({
      sendBall: session.sendBall,
      getGhostBalls: () => session.live.ghostBalls,
      reportFinish: session.reportFinish,
    }),
    [],
  );

  useBounceFlickGame({ actionsRef, canvasRef, level, levelStartedAt, net, setHud });

  useEffect(() => {
    if (hud.phase !== 'crashed') {
      return;
    }

    const timeoutId = window.setTimeout(onRestart, AUTO_RESTART_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [hud.phase, onRestart]);

  const clearDrawings = useCallback(() => {
    actionsRef.current?.clearDrawings();
  }, []);

  const eraseRecentInk = useCallback(() => {
    actionsRef.current?.eraseRecentInk();
  }, []);

  return (
    <main className="game-shell">
      <GameHeader hud={hud} onClearDrawings={clearDrawings} onEraseRecentInk={eraseRecentInk} />
      <GameStage canvasRef={canvasRef} hud={hud} />
    </main>
  );
}
