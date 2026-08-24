import { useEffect, useRef, useState } from "react";
import type { HomeworkMessage } from "@workspace/api-client-react";

export type HomeworkChatStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

type HomeworkChatOptions = {
  programId: string;
  role: "client" | "practitioner";
  token?: string;
  onMessage: (message: HomeworkMessage) => void;
  onSnapshot: (messages: HomeworkMessage[]) => void;
};

function getWebSocketUrl() {
  const url = new URL("/api/ws", window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function parseHomeworkMessage(value: unknown): HomeworkMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Partial<HomeworkMessage>;
  if (
    typeof message.id !== "string" ||
    typeof message.programId !== "string" ||
    typeof message.clientId !== "string" ||
    typeof message.senderRole !== "string" ||
    typeof message.createdAt !== "string" ||
    (message.senderRole !== "client" && message.senderRole !== "practitioner")
  ) {
    return null;
  }
  return message as HomeworkMessage;
}

export function useHomeworkChat({
  programId,
  role,
  token,
  onMessage,
  onSnapshot,
}: HomeworkChatOptions) {
  const onMessageRef = useRef(onMessage);
  const onSnapshotRef = useRef(onSnapshot);
  const [status, setStatus] = useState<HomeworkChatStatus>("connecting");

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    if (!programId || typeof WebSocket === "undefined") {
      setStatus("offline");
      return;
    }

    let disposed = false;
    let reconnectTimer: number | undefined;
    let heartbeatTimer: number | undefined;
    let retryDelay = 500;
    let shouldReconnect = true;
    let socket: WebSocket | undefined;

    const scheduleReconnect = () => {
      if (disposed || !shouldReconnect || reconnectTimer !== undefined) return;
      setStatus("reconnecting");
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 10_000);
    };

    const connect = () => {
      if (disposed) return;
      setStatus(retryDelay === 500 ? "connecting" : "reconnecting");
      socket = new WebSocket(getWebSocketUrl());

      socket.addEventListener("open", () => {
        if (disposed || !socket) return;
        retryDelay = 500;
        socket.send(JSON.stringify({
          type: "subscribe",
          role,
          programId,
          ...(role === "client" && token ? { token } : {}),
        }));
        heartbeatTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 20_000);
      });

      socket.addEventListener("message", (event) => {
        let payload: unknown;
        try {
          payload = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (
          !payload ||
          typeof payload !== "object" ||
          !("type" in payload)
        ) {
          return;
        }
        if (payload.type === "subscribed") {
          const subscribed = payload as {
            programId?: unknown;
            messages?: unknown;
          };
          if (subscribed.programId !== programId) return;
          const messages = Array.isArray(subscribed.messages)
            ? subscribed.messages
                .map(parseHomeworkMessage)
                .filter((message): message is HomeworkMessage => message !== null)
            : [];
          onSnapshotRef.current(messages);
          setStatus("connected");
          return;
        }
        if (payload.type === "error") {
          const errorPayload = payload as { code?: unknown };
          if (errorPayload.code === "UNAUTHORIZED") {
            shouldReconnect = false;
            setStatus("offline");
            socket?.close();
          }
          return;
        }
        if (
          payload.type !== "message" ||
          !("message" in payload) ||
          !payload.message ||
          typeof payload.message !== "object"
        ) {
          return;
        }

        const message = parseHomeworkMessage(payload.message);
        if (!message || message.programId !== programId) {
          return;
        }
        onMessageRef.current(message);
      });

      socket.addEventListener("error", () => {
        socket?.close();
      });

      socket.addEventListener("close", (event) => {
        if (heartbeatTimer !== undefined) {
          window.clearInterval(heartbeatTimer);
          heartbeatTimer = undefined;
        }
        if (event.code === 1008) {
          shouldReconnect = false;
          setStatus("offline");
          return;
        }
        scheduleReconnect();
      });
    };

    connect();

    return () => {
      disposed = true;
      shouldReconnect = false;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (heartbeatTimer !== undefined) window.clearInterval(heartbeatTimer);
      socket?.close();
    };
  }, [programId, role, token]);

  return { status };
}
