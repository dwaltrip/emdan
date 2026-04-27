import type { ClientRole } from "@shared/protocol";

import "./waiting-content.css";

interface WaitingContentProps {
  waitingFor: ClientRole;
}

export function WaitingContent({ waitingFor }: WaitingContentProps) {
  const label = waitingFor === "bot" ? "AI opponent" : "human opponent";

  return (
    <section className="waiting-panel">
      <h1 className="waiting-title">Waiting for {label}…</h1>
      <p className="waiting-hint">
        {waitingFor === "bot"
          ? "An AI bot will join as soon as one is available."
          : "Sit tight — pairing you with the next available player."}
      </p>
    </section>
  );
}
