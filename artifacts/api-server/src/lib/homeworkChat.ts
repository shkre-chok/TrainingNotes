import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { and, eq } from "drizzle-orm";
import {
  db,
  homeworkMessagesTable,
  homeworkProgramsTable,
  magicLinkTokensTable,
} from "@workspace/db";
import { z } from "zod";
import { logger } from "./logger";

export type HomeworkMessage = typeof homeworkMessagesTable.$inferSelect;
export type HomeworkChatRole = "client" | "practitioner";

export function serializeHomeworkMessage(message: HomeworkMessage) {
  return {
    id: message.id,
    programId: message.programId,
    clientId: message.clientId,
    senderRole: message.senderRole,
    content: message.content,
    audioUrl: message.audioUrl,
    createdAt: message.createdAt.toISOString(),
  };
}

const SubscribeMessage = z.object({
  type: z.literal("subscribe"),
  role: z.enum(["client", "practitioner"]),
  programId: z.string().min(1),
  token: z.string().min(1).optional(),
}).superRefine((message, context) => {
  if (message.role === "client" && !message.token) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["token"],
      message: "A magic-link token is required for client subscriptions",
    });
  }
});

type HomeworkChatSubscription = {
  socket: WebSocket;
  programId: string;
  role: HomeworkChatRole;
};

const subscriptions = new Map<WebSocket, HomeworkChatSubscription>();
const programSubscribers = new Map<string, Set<HomeworkChatSubscription>>();

function send(socket: WebSocket, message: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function removeSubscription(socket: WebSocket) {
  const subscription = subscriptions.get(socket);
  if (!subscription) return;

  subscriptions.delete(socket);
  const subscribers = programSubscribers.get(subscription.programId);
  subscribers?.delete(subscription);
  if (subscribers?.size === 0) {
    programSubscribers.delete(subscription.programId);
  }
}

async function isAuthorizedSubscription(message: z.infer<typeof SubscribeMessage>) {
  if (message.role === "practitioner") {
    // Practitioner REST routes currently use the same program-id access model
    // and do not expose an authenticated practitioner identity. Keep the
    // WebSocket scope aligned with those routes until that identity exists.
    const [program] = await db.select({ id: homeworkProgramsTable.id })
      .from(homeworkProgramsTable)
      .where(eq(homeworkProgramsTable.id, message.programId));
    return Boolean(program);
  }

  const [program] = await db.select({ id: homeworkProgramsTable.id })
    .from(homeworkProgramsTable)
    .innerJoin(
      magicLinkTokensTable,
      eq(homeworkProgramsTable.clientId, magicLinkTokensTable.clientId),
    )
    .where(and(
      eq(homeworkProgramsTable.id, message.programId),
      eq(homeworkProgramsTable.isActive, true),
      eq(magicLinkTokensTable.token, message.token!),
    ));
  return Boolean(program);
}

async function getProgramMessages(programId: string) {
  const messages = await db.select().from(homeworkMessagesTable)
    .where(eq(homeworkMessagesTable.programId, programId))
    .orderBy(homeworkMessagesTable.createdAt);
  return messages.map(serializeHomeworkMessage);
}

function rawDataToString(data: RawData) {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  return Buffer.from(new Uint8Array(data)).toString("utf8");
}

function handleSocket(socket: WebSocket, request: IncomingMessage) {
  let isProcessingSubscription = false;

  socket.on("message", async (rawData) => {
    if (subscriptions.has(socket)) {
      try {
        const message = JSON.parse(rawDataToString(rawData)) as { type?: unknown };
        if (message.type === "ping") {
          send(socket, { type: "pong" });
          return;
        }
      } catch {
        // The malformed-message response below is deliberately generic.
      }
      send(socket, { type: "error", code: "INVALID_MESSAGE", message: "Only heartbeat messages are accepted after subscribing" });
      return;
    }

    if (isProcessingSubscription) {
      send(socket, { type: "error", code: "INVALID_MESSAGE", message: "Subscription is already being authorized" });
      return;
    }
    isProcessingSubscription = true;

    try {
      let parsedMessage: unknown;
      try {
        parsedMessage = JSON.parse(rawDataToString(rawData));
      } catch {
        send(socket, { type: "error", code: "INVALID_MESSAGE", message: "Message must be valid JSON" });
        socket.close(1003, "Invalid message");
        return;
      }

      const parsed = SubscribeMessage.safeParse(parsedMessage);
      if (!parsed.success) {
        send(socket, { type: "error", code: "INVALID_MESSAGE", message: "Send a valid subscription message" });
        socket.close(1008, "Invalid subscription");
        return;
      }

      if (!await isAuthorizedSubscription(parsed.data)) {
        send(socket, { type: "error", code: "UNAUTHORIZED", message: "You cannot subscribe to this homework program" });
        socket.close(1008, "Unauthorized");
        return;
      }

      const subscription: HomeworkChatSubscription = {
        socket,
        programId: parsed.data.programId,
        role: parsed.data.role,
      };
      subscriptions.set(socket, subscription);
      const subscribers = programSubscribers.get(subscription.programId) ?? new Set();
      subscribers.add(subscription);
      programSubscribers.set(subscription.programId, subscribers);
      const messages = await getProgramMessages(subscription.programId);
      send(socket, {
        type: "subscribed",
        programId: subscription.programId,
        role: subscription.role,
        messages,
      });
    } catch (error) {
      logger.warn({ err: error }, "Homework WebSocket subscription failed");
      send(socket, { type: "error", code: "SERVER_ERROR", message: "Unable to subscribe right now" });
      socket.close(1011, "Subscription failed");
    } finally {
      isProcessingSubscription = false;
    }
  });

  socket.on("close", () => removeSubscription(socket));
  socket.on("error", (error) => {
    logger.debug({ err: error }, "Homework WebSocket connection error");
    removeSubscription(socket);
  });

  logger.debug({ userAgent: request.headers["user-agent"] }, "Homework WebSocket connected");
}

export function publishHomeworkMessage(message: HomeworkMessage) {
  const subscribers = programSubscribers.get(message.programId);
  if (!subscribers) return;

  const payload = JSON.stringify({
    type: "message",
    message: serializeHomeworkMessage(message),
  });
  for (const subscription of subscribers) {
    if (subscription.role === message.senderRole) continue;
    if (subscription.socket.readyState !== WebSocket.OPEN) {
      removeSubscription(subscription.socket);
      continue;
    }
    subscription.socket.send(payload);
  }
}

export function attachHomeworkWebSocket(server: Server) {
  const webSocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024,
  });

  server.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url ?? "", `http://${request.headers.host ?? "localhost"}`);
    if (requestUrl.pathname !== "/api/ws") {
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (clientSocket) => {
      webSocketServer.emit("connection", clientSocket, request);
    });
  });

  webSocketServer.on("connection", handleSocket);

  const aliveSockets = new Map<WebSocket, boolean>();
  webSocketServer.on("connection", (socket) => {
    aliveSockets.set(socket, true);
    socket.on("pong", () => aliveSockets.set(socket, true));
    socket.on("close", () => aliveSockets.delete(socket));
  });

  const heartbeat = setInterval(() => {
    for (const socket of webSocketServer.clients) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      if (!aliveSockets.get(socket)) {
        socket.terminate();
        continue;
      }
      aliveSockets.set(socket, false);
      socket.ping();
    }
  }, 30_000);
  webSocketServer.on("close", () => clearInterval(heartbeat));

  return webSocketServer;
}