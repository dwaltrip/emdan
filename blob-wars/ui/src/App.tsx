import { useEffect, useMemo, useState } from "react";

import {
  GRID_HEIGHT,
  GRID_WIDTH,
} from "../../shared/protocol.ts";
import "./App.css";
import { Board } from "./board.tsx";
import { createActions, createBlobWarsBoardStore } from "./board-store";
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
  const [customX, setCustomX] = useState(Math.floor(GRID_WIDTH / 2));
  const [customY, setCustomY] = useState(Math.floor(GRID_HEIGHT / 2));

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
    send({
      type: "plantSeed",
      x,
      y,
    });
  }

  function plantRandomSeed(): void {
    plantSeed(randomCoordinate(GRID_WIDTH), randomCoordinate(GRID_HEIGHT));
  }

  const statusLabel =
    status === "connected"
      ? "Connected"
      : status === "connecting"
        ? "Connecting"
        : "Disconnected";

  return (
    <main className="app-shell">
      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">Blob Wars UI</p>
          <h1>Websocket event console</h1>
          <p className="subtitle">
            The frontend imports the same typed websocket protocol as the Node server, so the
            message shapes, board dimensions, and parsers stay aligned.
          </p>
        </div>

        <div className="status-row">
          <span className={`status-pill status-${status}`}>{statusLabel}</span>
          <span className="meta-pill">Seat: {seat ?? "unassigned"}</span>
          <span className="meta-pill">Board: {GRID_WIDTH} x {GRID_HEIGHT}</span>
        </div>
      </section>

      <section className="grid-layout">
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
          </div>
        </section>

        <section className="panel">
          <h2>Client events</h2>
          <div className="button-row">
            <button onClick={() => send({ type: "joinLobby" })}>Emit `joinLobby`</button>
            <button onClick={() => send({ type: "ping" })}>Emit `ping`</button>
          </div>

          <div className="button-grid">
            <button onClick={() => plantSeed(0, 0)}>Plant top-left</button>
            <button onClick={() => plantSeed(GRID_WIDTH - 1, 0)}>Plant top-right</button>
            <button onClick={() => plantSeed(0, GRID_HEIGHT - 1)}>Plant bottom-left</button>
            <button onClick={() => plantSeed(GRID_WIDTH - 1, GRID_HEIGHT - 1)}>
              Plant bottom-right
            </button>
            <button onClick={() => plantSeed(Math.floor(GRID_WIDTH / 2), Math.floor(GRID_HEIGHT / 2))}>
              Plant center
            </button>
            <button onClick={plantRandomSeed}>Plant random</button>
          </div>

          <div className="custom-seed">
            <label className="field">
              <span>X</span>
              <input
                type="number"
                min={0}
                max={GRID_WIDTH - 1}
                value={customX}
                onChange={(event) => setCustomX(Number.parseInt(event.target.value || "0", 10))}
              />
            </label>
            <label className="field">
              <span>Y</span>
              <input
                type="number"
                min={0}
                max={GRID_HEIGHT - 1}
                value={customY}
                onChange={(event) => setCustomY(Number.parseInt(event.target.value || "0", 10))}
              />
            </label>
            <button onClick={() => plantSeed(customX, customY)}>Emit custom `plantSeed`</button>
          </div>
        </section>

        <section className="panel">
          <h2>Latest server message</h2>
          <pre>{latestMessage ? JSON.stringify(latestMessage, null, 2) : "No messages yet."}</pre>
        </section>

        <section className="panel panel-wide">
          <h2>Match state</h2>
          {latestSnapshot ? (
            <>
              <div className="snapshot-summary">
                <span>Match: {latestSnapshot.matchId}</span>
                <span>Tick: {latestSnapshot.tick}</span>
                <span>Player 1 tiles: {latestSnapshot.players.player1.occupiedTiles}</span>
                <span>Player 2 tiles: {latestSnapshot.players.player2.occupiedTiles}</span>
              </div>

              <div className="board-legend" aria-label="Board legend">
                <span className="legend-item">
                  <span className="legend-swatch legend-seed" aria-hidden="true" />
                  Original seed
                </span>
                <span className="legend-item">
                  <span className="legend-swatch legend-spread" aria-hidden="true" />
                  Spread blob
                </span>
              </div>

              <Board
                store={store}
                width={latestSnapshot.board.width}
                height={latestSnapshot.board.height}
                connected={status === "connected"}
                onPlant={plantSeed}
              />
            </>
          ) : (
            <p className="empty-state">No match snapshot received yet.</p>
          )}
        </section>

        <section className="panel panel-wide">
          <h2>Event log</h2>
          <div className="log-list">
            {logs.length > 0 ? (
              logs.map((entry) => (
                <div key={entry.id} className={`log-entry log-${entry.direction}`}>
                  <strong>{entry.direction.toUpperCase()}</strong>
                  <code>{entry.text}</code>
                </div>
              ))
            ) : (
              <p className="empty-state">No events yet.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function randomCoordinate(size: number): number {
  return Math.floor(Math.random() * size);
}

function getDefaultWsUrl(port: string): string {
  if (typeof window === "undefined") {
    return `ws://localhost:${port}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:${port}`;
}

export default App;
