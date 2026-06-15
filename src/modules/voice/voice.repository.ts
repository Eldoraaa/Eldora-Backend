import { prisma } from "@/config/database";
import type { VoiceEmotionState } from "../../../generated/prisma/client";

export type CreateVoiceEmotionLogInput = {
  deviceId: string;
  emotionState: VoiceEmotionState;
  confidence: number;
  transcript?: string | null;
  intent?: string | null;
  responseSource?: string | null;
  latencyMs?: number | null;
};

export function createVoiceEmotionLog(input: CreateVoiceEmotionLogInput) {
  return prisma.trVoiceEmotionLog.create({ data: input });
}

export function findRecentVoiceEmotionLogs(deviceId: string, limit = 20) {
  return prisma.trVoiceEmotionLog.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      emotionState: true,
      confidence: true,
      intent: true,
      latencyMs: true,
      createdAt: true,
    },
  });
}

export function findVoiceEmotionLogsByDevice(deviceId: string, since: Date) {
  return prisma.trVoiceEmotionLog.findMany({
    where: { deviceId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: {
      emotionState: true,
      confidence: true,
      createdAt: true,
    },
  });
}
