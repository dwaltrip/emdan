import type { ServerMessage } from "../../shared/protocol.ts";
import type { LogEntry } from "./use-game-socket";

interface DebugPanelProps {
  latestMessage: ServerMessage | null;
  logs: LogEntry[];
}

export function DebugPanel({ latestMessage, logs }: DebugPanelProps) {
  return (
    <details className="debug-panel">
      <summary>Debug</summary>

      <section className="panel">
        <h2>Latest server message</h2>
        <pre>{latestMessage ? JSON.stringify(latestMessage, null, 2) : "No messages yet."}</pre>
      </section>

      <section className="panel">
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
    </details>
  );
}
