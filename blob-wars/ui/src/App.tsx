import { useEffect, useMemo, useState } from "react";

import {
  GRID_HEIGHT,
  GRID_WIDTH,
} from "../../shared/protocol.ts";
import "./App.css";
import { Board } from "./components/board.tsx";
import { createActions, createBlobWarsBoardStore } from "./board-store";
import { DebugPanel } from "./components/debug-panel.tsx";
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
    connect,
    disconnect,
    send,
  } = useGameSocket();

  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);

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

  const statusLabel =
    status === "connected"
      ? "Connected"
      : status === "connecting"
        ? "Connecting"
        : "Disconnected";

  if (seat !== null) {
    return (
      <main className="app-shell match-shell">
        {latestSnapshot && (
          <div className="snapshot-summary">
            <span>Match: {latestSnapshot.matchId}</span>
            <span>Tick: {latestSnapshot.tick}</span>
            <span>Player 1 tiles: {latestSnapshot.players.player1.occupiedTiles}</span>
            <span>Player 2 tiles: {latestSnapshot.players.player2.occupiedTiles}</span>
            <span>Player 1 seeds: {latestSnapshot.players.player1.seedsRemaining}</span>
            <span>Player 2 seeds: {latestSnapshot.players.player2.seedsRemaining}</span>
          </div>
        )}
        <Board
          store={store}
          width={GRID_WIDTH}
          height={GRID_HEIGHT}
          connected={status === "connected"}
          onPlant={plantSeed}
        />
        <DebugPanel latestMessage={latestMessage} logs={logs} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">Blob Wars UI</p>
        </div>

        <div className="status-row">
          <span className={`status-pill status-${status}`}>{statusLabel}</span>
          <span className="meta-pill">Board: {GRID_WIDTH} x {GRID_HEIGHT}</span>
        </div>
      </section>

      <section className="panel">
        <h2>Connection</h2>
        <label className="field">
          <span>Websocket URL</span>
          <input value={wsUrl} onChange={(event) => setWsUrl(event.target.value)} />
        </label>

        <div className="button-row">
          <button onClick={() => connect(wsUrl)} disabled={status !== "disconnected"}>
            Connect
          </button>
          <button onClick={disconnect} disabled={status === "disconnected"}>
            Disconnect
          </button>
          <button
            onClick={() => send({ type: "joinLobby" })}
            disabled={status !== "connected"}
          >
            Join lobby
          </button>
        </div>
      </section>

      <DebugPanel latestMessage={latestMessage} logs={logs} />
    </main>
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
