import { prisma } from "@/config/database";
import { verifyToken } from "@/utils/jwt.utils";
import type { Server } from "http";
import { WebSocketServer, type WebSocket } from "ws";

type LiveMessage = {
  type: "device.telemetry";
  homeId: string | null;
  deviceId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

type ClientState = {
  userId?: string;
  homeId?: string;
  deviceId?: string;
};

type SubscribeMessage = {
  type?: string;
  token?: string;
  homeId?: string;
  deviceId?: string;
};

const clients = new Map<WebSocket, ClientState>();

async function canSubscribe(userId: string, homeId?: string, deviceId?: string) {
  if (homeId) {
    const home = await prisma.msHome.findFirst({
      where: { id: homeId, members: { some: { userId } } },
      select: { id: true },
    });
    if (!home) return false;
  }

  if (deviceId) {
    const device = await prisma.msDevice.findFirst({
      where: {
        id: deviceId,
        OR: [
          { elderProfile: { userLinks: { some: { userId } } } },
          { roomCategory: { is: { home: { members: { some: { userId } } } } } },
        ],
      },
      select: { id: true },
    });
    if (!device) return false;
  }

  return Boolean(homeId || deviceId);
}

function sendError(socket: WebSocket, message: string) {
  socket.send(JSON.stringify({ type: "error", message }));
}

export function attachRealtimeServer(server: Server) {
  const wss = new WebSocketServer({ server, path: "/realtime" });

  wss.on("connection", (socket) => {
    clients.set(socket, {});

    socket.on("message", (raw) => {
      void (async () => {
        try {
          const message = JSON.parse(String(raw)) as SubscribeMessage;
          if (message.type !== "subscribe") return;
          if (!message.token) {
            sendError(socket, "Realtime token required");
            socket.close(1008, "Unauthorized");
            return;
          }
          const payload = verifyToken(message.token);
          const allowed = await canSubscribe(payload.id, message.homeId, message.deviceId);
          if (!allowed) {
            sendError(socket, "Realtime subscription not allowed");
            socket.close(1008, "Forbidden");
            return;
          }
          clients.set(socket, {
            userId: payload.id,
            homeId: message.homeId,
            deviceId: message.deviceId,
          });
          socket.send(JSON.stringify({ type: "subscribed", homeId: message.homeId ?? null, deviceId: message.deviceId ?? null }));
        } catch {
          sendError(socket, "Invalid realtime payload");
          socket.close(1008, "Unauthorized");
        }
      })();
    });

    socket.on("close", () => {
      clients.delete(socket);
    });
  });

  return wss;
}

export function broadcastDeviceTelemetry(message: LiveMessage) {
  const serialized = JSON.stringify(message);
  for (const [socket, state] of clients.entries()) {
    if (socket.readyState !== socket.OPEN) continue;
    if (!state.userId) continue;
    if (state.homeId && message.homeId && state.homeId !== message.homeId) continue;
    if (state.deviceId && state.deviceId !== message.deviceId) continue;
    socket.send(serialized);
  }
}
