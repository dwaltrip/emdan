import { useEffect, useRef, useState } from "react";

import {
  GRID_HEIGHT,
  GRID_WIDTH,
  type ClientMessage,
  type MatchSnapshot,
  type PlayerSeat,
  type ServerMessage,
  parseServerMessage,
  serializeClientMessage,
} from "../../shared/protocol.ts";
import "./App.css";

const DEFAULT_WS_PORT = import.meta.env.VITE_WS_PORT ?? "3002";
const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL ?? getDefaultWsUrl(DEFAULT_WS_PORT);

type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface LogEntry {
  id: number;
  direction: "system" | "out" | "in";
  text: string;
}

function App() {
  const socketRef = useRef<WebSocket | null>(null);
  const logIdRef = useRef(0);

  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [seat, setSeat] = useState<PlayerSeat | null>(null);
  const [customX, setCustomX] = useState(Math.floor(GRID_WIDTH / 2));
  const [customY, setCustomY] = useState(Math.floor(GRID_HEIGHT / 2));
  const [latestMessage, setLatestMessage] = useState<ServerMessage | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<MatchSnapshot | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  function appendLog(direction: LogEntry["direction"], text: string): void {
    const nextEntry: LogEntry = {
      id: logIdRef.current,
      direction,
      text,
    };
    logIdRef.current += 1;

    setLogs((current) => [nextEntry, ...current].slice(0, 30));
  }

  function connect(): void {
    const activeSocket = socketRef.current;
    if (activeSocket && activeSocket.readyState !== WebSocket.CLOSED) {
      return;
    }

    setStatus("connecting");
    appendLog("system", `Connecting to ${wsUrl}`);

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setStatus("connected");
      appendLog("system", "Socket connected.");
    });

    socket.addEventListener("close", () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      setStatus("disconnected");
      setSeat(null);
      appendLog("system", "Socket closed.");
    });

    socket.addEventListener("error", () => {
      appendLog("system", "Socket error.");
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        appendLog("in", "Received a non-text websocket payload.");
        return;
      }

      const parsed = parseServerMessage(event.data);
      if (!parsed) {
        appendLog("in", `Unparsed server payload: ${event.data}`);
        return;
      }

      setLatestMessage(parsed);
      if ("state" in parsed) {
        setLatestSnapshot(parsed.state);
      }

      if (parsed.type === "welcome" || parsed.type === "matchStarted") {
        setSeat(parsed.seat);
      }

      appendLog("in", JSON.stringify(parsed));
    });
  }

  function disconnect(): void {
    socketRef.current?.close();
  }

  function sendMessage(message: ClientMessage): void {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      appendLog("system", "Cannot send a message while disconnected.");
      return;
    }

    const payload = serializeClientMessage(message);
    socket.send(payload);
    appendLog("out", payload);
  }

  function plantSeed(x: number, y: number): void {
    sendMessage({
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
            <button onClick={connect} disabled={status !== "disconnected"}>
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
            <button onClick={() => sendMessage({ type: "joinLobby" })}>Emit `joinLobby`</button>
            <button onClick={() => sendMessage({ type: "ping" })}>Emit `ping`</button>
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

        <section className="panel">
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

              <div
                className="board"
                style={{
                  gridTemplateColumns: `repeat(${latestSnapshot.board.width}, 1fr)`,
                }}
              >
                {latestSnapshot.board.tiles.flatMap((row, y) =>
                  row.map((tile, x) => (
                    <button
                      key={`${x}-${y}`}
                      type="button"
                      className={`tile tile-${tile.owner ?? "empty"} tile-origin-${tile.origin ?? "empty"}`}
                      title={
                        tile.owner === null
                          ? `Plant at (${x}, ${y})`
                          : `(${x}, ${y}) ${tile.owner} ${describeTileOrigin(tile.origin)}`
                      }
                      aria-label={
                        tile.owner === null
                          ? `Plant seed at ${x}, ${y}`
                          : `Tile ${x}, ${y} owned by ${tile.owner}, ${describeTileOrigin(tile.origin)}`
                      }
                      disabled={tile.owner !== null || status !== "connected"}
                      onClick={() => plantSeed(x, y)}
                    />
                  )),
                )}
              </div>
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

function describeTileOrigin(origin: MatchSnapshot["board"]["tiles"][number][number]["origin"]): string {
  return origin === "seed" ? "seed" : "spread";
}

function getDefaultWsUrl(port: string): string {
  if (typeof window === "undefined") {
    return `ws://localhost:${port}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:${port}`;
}

export default App;
