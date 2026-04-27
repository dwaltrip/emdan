import { WebSocket } from "ws";

import {
  type ClientMessage,
  type MatchSnapshot,
  type PlayerSeat,
  type ServerMessage,
  parseServerMessage,
  serializeClientMessage,
} from "@shared/protocol";

import { blobWarsAI } from "@/blob-wars-ai";

const WS_URL = process.env.AI_WS_URL ?? "ws://localhost:3002";
const VERBOSE = process.env.VERBOSE === "1" || process.env.VERBOSE === "true";

type AiState =
  | { kind: "idle" }
  | { kind: "inMatch"; seat: PlayerSeat };

export function startAiPlayer(): void {
  let state: AiState = { kind: "idle" };
  const socket = new WebSocket(WS_URL);

  socket.on("open", () => {
    console.log(`[ai-player] connected to ${WS_URL}, joining lobby`);
    send({ type: "joinLobby" });
  });

  socket.on("message", (raw) => {
    const msg = parseServerMessage(raw.toString());
    if (!msg) {
      console.warn("[ai-player] unparsed payload");
      return;
    }
    handleMessage(msg);
  });

  socket.on("close", () => {
    console.log("[ai-player] socket closed, exiting");
    process.exit(0);
  });

  socket.on("error", (err) => {
    console.error("[ai-player] socket error", err);
  });

  function handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "welcome":
      case "lobbyUpdate":
        return;

      case "error":
        console.warn(`[ai-player] server error: ${msg.code} — ${msg.message}`);
        return;

      case "matchStarted":
        state = { kind: "inMatch", seat: msg.seat };
        console.log(`[ai-player] match started, seat=${msg.seat}`);
        maybeAct(msg.state);
        return;

      case "stateUpdate":
        if (VERBOSE) logSnapshot(msg.state);
        maybeAct(msg.state);
        return;

      case "matchEnded":
        console.log(
          `[ai-player] match ended: reason=${msg.reason}, winner=${msg.winner}`,
        );
        state = { kind: "idle" };
        socket.close();
        return;
    }
  }

  function maybeAct(snapshot: MatchSnapshot): void {
    if (state.kind !== "inMatch") return;
    if (!isMyTurn(snapshot, state.seat)) return;

    const move = blobWarsAI.getMove(snapshot, state.seat);
    if (!move) return;

    if (VERBOSE) {
      console.log(`[ai-player] sending move:`, move);
    }
    send(move);
  }

  function send(msg: ClientMessage): void {
    if (socket.readyState !== WebSocket.OPEN) {
      console.warn("[ai-player] send while not open", msg);
      return;
    }
    socket.send(serializeClientMessage(msg));
  }
}

function logSnapshot(snapshot: MatchSnapshot): void {
  const seat = snapshot.currentUser.seat;
  const seeds = seat ? snapshot.players[seat].seedsRemaining : "?";
  console.log(
    `[ai-player] snapshot: tick=${snapshot.tick} phase=${snapshot.phase} ` +
      `currentTurn=${snapshot.currentTurn ?? "-"} mySeeds=${seeds}`,
  );
}

function isMyTurn(snapshot: MatchSnapshot, seat: PlayerSeat): boolean {
  if (snapshot.phase === "placing") {
    return snapshot.currentTurn === seat;
  }
  return false;
}
