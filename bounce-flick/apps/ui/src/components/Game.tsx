import { useCallback, useEffect, useState } from 'react';

import type { GeneratedLevel } from '../game/types';
import { useBounceFlickGame } from '../hooks/useBounceFlickGame';
import type { Multiplayer } from '../net/session';
import { GameHeader } from './GameHeader';
import { GameStage } from './GameStage';

const AUTO_RESTART_DELAY_MS = 600;

type GameProps = {
  level: GeneratedLevel;
  multiplayer: Multiplayer;
};

export function Game({ level, multiplayer }: GameProps) {
  const [runKey, setRunKey] = useState(0);
  const restart = useCallback(() => setRunKey((key) => key + 1), []);

  return <GameRun key={runKey} level={level} multiplayer={multiplayer} onRestart={restart} />;
}

function GameRun({
  level,
  multiplayer,
  onRestart,
}: GameProps & {
  onRestart: () => void;
}) {
  const game = useBounceFlickGame({ level, multiplayer });

  useEffect(() => {
    if (game.hud.phase !== 'crashed') {
      return;
    }

    const timeoutId = window.setTimeout(onRestart, AUTO_RESTART_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [game.hud.phase, onRestart]);

  return (
    <main className="game-shell">
      <GameHeader
        hud={game.hud}
        onClearDrawings={game.clearInk}
        onEraseRecentInk={game.eraseRecentInk}
      />
      <GameStage canvasRef={game.canvasRef} hud={game.hud} />
    </main>
  );
}
