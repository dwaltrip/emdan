import { useEffect, useMemo } from "react";

import {
  GRID_HEIGHT,
  GRID_WIDTH,
} from "@shared/protocol";
import "./App.css";
import { Board } from "./components/board";
import { createActions, createBlobWarsBoardStore } from "./board-store";
import { DebugPanel } from "./components/debug-panel";
import { useGameSocket } from "./use-game-socket";

const DEFAULT_WS_PORT = import.meta.env.VITE_WS_PORT ?? "3002";
const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL ?? getDefaultWsUrl(DEFAULT_WS_PORT);

function App() {
  const {
    status,
    seat,
    latestMessage,
    latestSnapshot,
    logs,
    send,
  } = useGameSocket(DEFAULT_WS_URL);

  const store = useMemo(
    () => createBlobWarsBoardStore(GRID_WIDTH, GRID_HEIGHT),
    [],
  );
  const actions = useMemo(() => createActions(store), [store]);

  useEffect(() => {
    if (latestSnapshot) {
      actions.applySnapshot(latestSnapshot);
    }
  }, [latestSnapshot, actions]);

  function plantSeed(x: number, y: number): void {
    if (seat !== null && latestSnapshot && latestSnapshot.players[seat].seedsRemaining <= 0) {
      return;
    }

    send({
      type: "plantSeed",
      x,
      y,
    });
  }

  if (seat !== null) {
    return (
      <>
        <main className="app-shell match-shell">
          {latestSnapshot && <MatchDetails snapshot={latestSnapshot} seat={seat} />}
          <Board
            store={store}
            width={GRID_WIDTH}
            height={GRID_HEIGHT}
            connected={status === "connected"}
            onPlant={plantSeed}
          />
          <DebugPanel latestMessage={latestMessage} logs={logs} />
        </main>
        <StatusBar status={status} />
      </>
    );
  }

  return (
    <>
      <main className="app-shell app-shell-pre-match">
        <section className="hero-panel">
          <h1 className="hero-title">Blob Wars</h1>
          {status === "connected" && (
            <button onClick={() => send({ type: "joinLobby" })}>
              Join lobby
            </button>
          )}
        </section>

        <DebugPanel latestMessage={latestMessage} logs={logs} />
      </main>
      <StatusBar status={status} />
    </>
  );
}

interface StatusBarProps {
  status: "connected" | "connecting" | "disconnected";
}

function StatusBar({ status }: StatusBarProps) {
  const label =
    status === "connected"
      ? "Connected"
      : status === "connecting"
        ? "Connecting"
        : "Disconnected";

  return (
    <div className={`status-bar status-bar-${status}`}>
      <span className="status-bar-dot" />
      <span>{label}</span>
    </div>
  );
}

interface MatchDetailsProps {
  snapshot: NonNullable<ReturnType<typeof useGameSocket>["latestSnapshot"]>;
  seat: NonNullable<ReturnType<typeof useGameSocket>["seat"]>;
}

function MatchDetails({ snapshot, seat }: MatchDetailsProps) {
  return (
    <div className="match-details">
      <div className="match-meta">
        <span>Match: {snapshot.matchId}</span>
        <span>Tick: {snapshot.tick}</span>
      </div>
      <div className="player-cards">
        <PlayerCard
          label="Player 1"
          tiles={snapshot.players.player1.occupiedTiles}
          seeds={snapshot.players.player1.seedsRemaining}
          isYou={seat === "player1"}
        />
        <PlayerCard
          label="Player 2"
          tiles={snapshot.players.player2.occupiedTiles}
          seeds={snapshot.players.player2.seedsRemaining}
          isYou={seat === "player2"}
        />
      </div>
    </div>
  );
}

interface PlayerCardProps {
  label: string;
  tiles: number;
  seeds: number;
  isYou: boolean;
}

function PlayerCard({ label, tiles, seeds, isYou }: PlayerCardProps) {
  return (
    <div className={`player-card${isYou ? " player-card-you" : ""}`}>
      <span className="player-card-label">{label}</span>
      {isYou && <span className="player-card-you-badge">You</span>}
      <span className="player-card-stats">
        {tiles} tiles · {seeds} seeds
      </span>
    </div>
  );
}

function getDefaultWsUrl(port: string): string {
  if (typeof window === "undefined") {
    return `ws://localhost:${port}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:${port}`;
}

export default App;
