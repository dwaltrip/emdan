import type { ConnectionStatus } from "@/board-store";
import type { Session } from "@/session/session";

import "./home-content.css";

interface HomeContentProps {
  session: Session;
  status: ConnectionStatus;
}

export function HomeContent({ session, status }: HomeContentProps) {
  return (
    <section className="hero-panel">
      <h1 className="hero-title">Blob Wars</h1>
      {status === "connected" && (
        <button className="join-lobby-button" onClick={() => session.joinLobby()}>
          Join lobby
        </button>
      )}
    </section>
  );
}
