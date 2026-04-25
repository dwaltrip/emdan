import { useSyncExternalStore } from "react";

import type { PlayerSeat } from "@shared/protocol";
import { GRID_HEIGHT, GRID_WIDTH } from "@shared/protocol";

import "./App.css";
import type { Session } from "./session/session";
import { session } from "./session/session-instance";
import type { ConnectionStatus, SourceState } from "./board-store";
import { Board } from "./components/board";
import { useCurrentUser } from "./hooks/use-current-user";
import { useMatchId } from "./hooks/use-match-id";
import { useStatus } from "./hooks/use-status";
import { BoardProfiler } from "./lib/board-profiler";

function App() {
  const status = useStatus(session);
  const { seat } = useCurrentUser(session);
  const matchId = useMatchId(session);

  return (
    <main className="app-shell">
      <div className="app-content">
        {seat !== null ? (
          <>
            <MatchDetails session={session} />
            <BoardProfiler>
              <Board
                key={matchId}
                session={session}
                width={GRID_WIDTH}
                height={GRID_HEIGHT}
              />
            </BoardProfiler>
          </>
        ) : (
          <section className="hero-panel">
            <h1 className="hero-title">Blob Wars</h1>
            {status === "connected" && (
              <button onClick={() => session.joinLobby()}>
                Join lobby
              </button>
            )}
          </section>
        )}
      </div>
      <StatusBar status={status} />
    </main>
  );
}

interface StatusBarProps {
  status: ConnectionStatus;
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
  session: Session;
}

function MatchDetails({ session }: MatchDetailsProps) {
  // Subscribe to every store change; this component intentionally re-renders
  // per tick. Returns the version primitive so React's dev warning about an
  // unstable getSnapshot result doesn't fire.
  useSyncExternalStore(session.store.subscribe, () => session.store.version);
  const { game } = session.store.state;
  const seat = game.currentUser.seat;
  if (seat === null) return null;

  return (
    <div className="match-details">
      <div className="match-meta">
        <span>Match: {game.matchId}</span>
        <span>Tick: {game.tick}</span>
        <span>{describePhase(game, seat)}</span>
      </div>
      <div className="player-cards">
        <PlayerCard
          label="Player 1"
          tiles={game.players.player1.occupiedTiles}
          seeds={game.players.player1.seedsRemaining}
          isYou={seat === "player1"}
        />
        <PlayerCard
          label="Player 2"
          tiles={game.players.player2.occupiedTiles}
          seeds={game.players.player2.seedsRemaining}
          isYou={seat === "player2"}
        />
      </div>
    </div>
  );
}

function describePhase(game: SourceState, seat: PlayerSeat): string {
  if (game.phase === "placing") {
    if (game.currentTurn === seat) return "Your turn to place a seed";
    return "Opponent placing…";
  }
  if (game.phase === "simulating") return "Simulating…";
  return "Match ended";
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

export default App;
