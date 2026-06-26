import { prisma } from "@/config/database";
import { ElderReminderStatus, SceneReminderDeliveryMode, type VoiceEmotionState } from "../../../generated/prisma/client";

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

export function findVoiceEmotionLogsByDevice(deviceId: string, since: Date, until?: Date) {
  return prisma.trVoiceEmotionLog.findMany({
    where: { deviceId, createdAt: { gte: since, ...(until ? { lte: until } : {}) } },
    orderBy: { createdAt: "asc" },
    select: {
      emotionState: true,
      confidence: true,
      createdAt: true,
    },
  });
}

export function createVoiceConversationTurn(input: {
  elderProfileId: string;
  deviceId: string;
  transcript: string;
  responseText?: string | null;
  intent?: string | null;
  emotionState?: VoiceEmotionState;
  confidence?: number;
  responseSource?: string | null;
  latencyMs?: number | null;
}) {
  return prisma.trVoiceConversationTurn.create({ data: input });
}

export function createElderReminder(input: {
  elderProfileId: string;
  deviceId: string;
  homeId?: string | null;
  title: string;
  message: string;
  dueAt: Date;
  timezone: string;
  recurrenceRule?: string | null;
  status?: ElderReminderStatus;
  createdFromTurnId?: string | null;
}) {
  return prisma.trElderReminder.create({ data: input });
}

export async function findVoiceContext(elderProfileId: string) {
  const [summary, facts, recentTurns] = await Promise.all([
    prisma.msElderContextSummary.findUnique({ where: { elderProfileId } }),
    prisma.msElderMemoryFact.findMany({
      where: { elderProfileId, status: { in: ["candidate", "confirmed"] } },
      orderBy: [{ confidence: "desc" }, { lastSeenAt: "desc" }],
      take: 5,
    }),
    prisma.trVoiceConversationTurn.findMany({
      where: { elderProfileId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { transcript: true, responseText: true, createdAt: true },
    }),
  ]);
  return { summary, facts, recentTurns: recentTurns.reverse() };
}

export function upsertElderMemoryFact(input: {
  elderProfileId: string;
  type: string;
  key: string;
  value: string;
  confidence: number;
  status?: string;
  sourceTurnId?: string | null;
}) {
  return prisma.msElderMemoryFact.upsert({
    where: { elderProfileId_key: { elderProfileId: input.elderProfileId, key: input.key } },
    create: {
      elderProfileId: input.elderProfileId,
      type: input.type,
      key: input.key,
      value: input.value,
      confidence: input.confidence,
      status: input.status ?? "candidate",
      sourceTurnId: input.sourceTurnId ?? null,
    },
    update: {
      value: input.value,
      confidence: input.confidence,
      status: input.status ?? "candidate",
      lastSeenAt: new Date(),
      sourceTurnId: input.sourceTurnId ?? null,
    },
  });
}

export function upsertElderContextSummary(input: {
  elderProfileId: string;
  summary?: string;
  preferenceSummary?: string;
  safetySummary?: string;
}) {
  return prisma.msElderContextSummary.upsert({
    where: { elderProfileId: input.elderProfileId },
    create: {
      elderProfileId: input.elderProfileId,
      summary: input.summary ?? "",
      preferenceSummary: input.preferenceSummary ?? "",
      safetySummary: input.safetySummary ?? "",
    },
    update: {
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.preferenceSummary !== undefined ? { preferenceSummary: input.preferenceSummary } : {}),
      ...(input.safetySummary !== undefined ? { safetySummary: input.safetySummary } : {}),
    },
  });
}

export function findDueElderReminders(now: Date, staleQueuedBefore: Date) {
  return prisma.trElderReminder.findMany({
    where: {
      dueAt: { lte: now },
      OR: [
        { status: ElderReminderStatus.pending },
        { status: ElderReminderStatus.queued, updatedAt: { lte: staleQueuedBefore }, attemptCount: { lt: 3 } },
      ],
    },
    take: 50,
    orderBy: { dueAt: "asc" },
    include: { device: true },
  });
}

export function failExpiredQueuedReminders(now: Date) {
  return prisma.trElderReminder.updateMany({
    where: {
      status: ElderReminderStatus.queued,
      OR: [
        { attemptCount: { gte: 3 } },
        { dueAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) } },
      ],
    },
    data: { status: ElderReminderStatus.failed, failedAt: now },
  });
}

export function findMemoryFactsForUser(userId: string, status = "candidate") {
  return prisma.msElderMemoryFact.findMany({
    where: {
      status,
      elderProfile: { userLinks: { some: { userId } } },
    },
    orderBy: [{ lastSeenAt: "desc" }, { confidence: "desc" }],
    include: { elderProfile: { select: { id: true, name: true } } },
  });
}

export function findMemoryFactForUser(userId: string, factId: string) {
  return prisma.msElderMemoryFact.findFirst({
    where: {
      id: factId,
      elderProfile: { userLinks: { some: { userId } } },
    },
  });
}

export function updateMemoryFactStatus(factId: string, status: "confirmed" | "rejected") {
  return prisma.msElderMemoryFact.update({
    where: { id: factId },
    data: { status },
  });
}

export function findElderRemindersForUser(userId: string, homeId?: string | null) {
  return prisma.trElderReminder.findMany({
    where: {
      ...(homeId ? { homeId } : {}),
      OR: [
        { home: { is: { members: { some: { userId } } } } },
        { elderProfile: { userLinks: { some: { userId } } } },
      ],
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    include: {
      device: { select: { id: true, name: true, deviceId: true } },
      elderProfile: { select: { id: true, name: true } },
      home: { select: { id: true, name: true } },
    },
  });
}

const reminderInclude = {
  device: { select: { id: true, name: true, deviceId: true } },
  elderProfile: { select: { id: true, name: true } },
  home: { select: { id: true, name: true } },
};

export function findElderReminderForUser(userId: string, reminderId: string) {
  return prisma.trElderReminder.findFirst({
    where: {
      id: reminderId,
      OR: [
        { home: { is: { members: { some: { userId } } } } },
        { elderProfile: { userLinks: { some: { userId } } } },
      ],
    },
  });
}

export function findElderReminderDetailForUser(userId: string, reminderId: string) {
  return prisma.trElderReminder.findFirst({
    where: {
      id: reminderId,
      OR: [
        { home: { is: { members: { some: { userId } } } } },
        { elderProfile: { userLinks: { some: { userId } } } },
      ],
    },
    include: reminderInclude,
  });
}

export function updateElderReminderStatus(
  reminderId: string,
  data: {
    status: ElderReminderStatus;
    deliveredAt?: Date | null;
    acknowledgedAt?: Date | null;
    cancelledAt?: Date | null;
    failedAt?: Date | null;
    attemptCount?: { increment: number };
  }
) {
  return prisma.trElderReminder.update({ where: { id: reminderId }, data });
}

export function findRecentSceneReminderDelivery(sceneId: string, elderProfileId: string, since: Date) {
  return prisma.trSceneReminderDelivery.findFirst({
    where: {
      sceneId,
      elderProfileId,
      deliveredAt: { gte: since },
    },
  });
}

export function createSceneReminderDelivery(input: {
  sceneId: string;
  elderProfileId: string;
  deviceId: string;
  deliveryMode: SceneReminderDeliveryMode;
}) {
  return prisma.trSceneReminderDelivery.create({ data: input });
}

export { SceneReminderDeliveryMode };
