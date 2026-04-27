import "./App.css";
import type { ConnectionStatus } from "./board-store";
import { HomeContent } from "./components/home-content";
import { MatchContent } from "./components/match-content";
import { WaitingContent } from "./components/waiting-content";
import { useCurrentUserSeat } from "./hooks/use-current-user-seat";
import { useStatus } from "./hooks/use-status";
import { useWaitingFor } from "./hooks/use-waiting-for";
import { session } from "./session/session-instance";

function App() {
  const status = useStatus(session);
  const seat = useCurrentUserSeat(session);
  const waitingFor = useWaitingFor(session);

  return (
    <main className="app-shell">
      <div className="app-content">
        {seat !== null ? (
          <MatchContent session={session} />
        ) : waitingFor !== null ? (
          <WaitingContent waitingFor={waitingFor} />
        ) : (
          <HomeContent session={session} status={status} />
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

export default App;
