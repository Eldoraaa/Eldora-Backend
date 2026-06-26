import { prisma } from "@/config/database";

export function getVoiceLogsInRange(deviceIds: string[], from: Date, to: Date) {
  return prisma.trVoiceEmotionLog.findMany({
    where: { deviceId: { in: deviceIds }, createdAt: { gte: from, lte: to } },
    select: {
      emotionState: true,
      confidence: true,
      intent: true,
      latencyMs: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export function getNotificationsInRange(
  userId: string,
  from: Date,
  to: Date,
  homeId?: string | null,
  deviceId?: string | null
) {
  return prisma.trNotification.findMany({
    where: {
      userId,
      createdAt: { gte: from, lte: to },
      ...(homeId ? { homeId } : {}),
      ...(deviceId ? { deviceId } : {}),
    },
    select: {
      id: true,
      type: true,
      metadata: true,
      createdAt: true,
      responses: {
        select: { createdAt: true },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
