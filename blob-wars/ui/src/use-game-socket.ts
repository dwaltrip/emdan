import { useEffect, useRef, useState } from "react";

import {
  type ClientMessage,
  type MatchSnapshot,
  type PlayerSeat,
  type ServerMessage,
  parseServerMessage,
  serializeClientMessage,
} from "@shared/protocol";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface LogEntry {
  id: number;
  direction: "system" | "out" | "in";
  text: string;
}

const MAX_LOG_ENTRIES = 30;

export function useGameSocket(url: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const logIdRef = useRef(0);

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [seat, setSeat] = useState<PlayerSeat | null>(null);
  const [latestMessage, setLatestMessage] = useState<ServerMessage | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<MatchSnapshot | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  function appendLog(direction: LogEntry["direction"], text: string): void {
    const nextEntry: LogEntry = {
      id: logIdRef.current,
      direction,
      text,
    };
    logIdRef.current += 1;

    setLogs((current) => [nextEntry, ...current].slice(0, MAX_LOG_ENTRIES));
  }

  function connect(url: string): void {
    const activeSocket = socketRef.current;
    if (activeSocket && activeSocket.readyState !== WebSocket.CLOSED) {
      return;
    }

    setStatus("connecting");
    appendLog("system", `Connecting to ${url}`);

    const socket = new WebSocket(url);
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

  function send(message: ClientMessage): void {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      appendLog("system", "Cannot send a message while disconnected.");
      return;
    }

    const payload = serializeClientMessage(message);
    socket.send(payload);
    appendLog("out", payload);
  }

  useEffect(() => {
    connect(url);
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return {
    status,
    seat,
    latestMessage,
    latestSnapshot,
    logs,
    send,
  };
}
