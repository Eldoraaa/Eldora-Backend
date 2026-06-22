import { prisma } from "@/config/database";
import type { Prisma } from "../../../generated/prisma/client";
import type { NotificationPreferenceInput } from "./notifications.validation";
import type {
  CreateNotificationInput,
  ListNotificationsInput,
} from "./notifications.validation";

const defaultPreference = {
  deviceAlertEnabled: true,
  dndEnabled: false,
  systemNotificationEnabled: true,
  homeAlertEnabled: true,
  fallAlertEnabled: true,
  sosAlertEnabled: true,
  deviceOfflineAlertEnabled: true,
  lowBatteryAlertEnabled: true,
  pairingRequestAlertEnabled: true,
  bulletinEnabled: true,
};

export function upsertNotificationDeviceToken(input: {
  userId: string;
  token: string;
  platform?: string | null;
  deviceId?: string | null;
}) {
  return prisma.msNotificationDeviceToken.upsert({
    where: { token: input.token },
    create: {
      userId: input.userId,
      token: input.token,
      platform: input.platform ?? null,
      deviceId: input.deviceId ?? null,
    },
    update: {
      userId: input.userId,
      platform: input.platform ?? null,
      deviceId: input.deviceId ?? null,
      lastSeen: new Date(),
    },
  });
}

export function deleteNotificationDeviceToken(token: string) {
  return prisma.msNotificationDeviceToken.deleteMany({ where: { token } });
}

export function findNotificationDeviceTokens(userId: string) {
  return prisma.msNotificationDeviceToken.findMany({ where: { userId } });
}

export function findOrCreateNotificationPreference(userId: string) {
  return prisma.msNotificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      ...defaultPreference,
    },
    update: {},
  });
}

export function updateNotificationPreference(
  userId: string,
  data: NotificationPreferenceInput
) {
  return prisma.msNotificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      ...defaultPreference,
      ...data,
    },
    update: data,
  });
}

export function findRecentDeviceEventNotification(
  userId: string,
  deviceId: string,
  eventType: string,
  since: Date
) {
  return prisma.trNotification.findFirst({
    where: {
      userId,
      deviceId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  }).then((notification) => {
    if (!notification?.metadata || typeof notification.metadata !== "object" || Array.isArray(notification.metadata)) return null;
    return (notification.metadata as Record<string, unknown>).eventType === eventType ? notification : null;
  });
}

export function findRecentHomeDeviceEventNotification(
  homeId: string,
  deviceId: string,
  eventType: string,
  since: Date
) {
  return prisma.trNotification.findFirst({
    where: {
      homeId,
      deviceId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  }).then((notification) => {
    if (!notification?.metadata || typeof notification.metadata !== "object" || Array.isArray(notification.metadata)) return null;
    return (notification.metadata as Record<string, unknown>).eventType === eventType ? notification : null;
  });
}

export function createNotificationResponse(input: {
  notificationId: string;
  userId: string;
  status: string;
  note?: string | null;
}) {
  return prisma.trNotificationResponse.create({ data: input });
}

export function upsertNotificationUserState(
  notificationId: string,
  userId: string,
  data: { readAt?: Date | null } = {}
) {
  return prisma.trNotificationUserState.upsert({
    where: { notificationId_userId: { notificationId, userId } },
    create: { notificationId, userId, readAt: data.readAt ?? null },
    update: data,
  });
}

export function createNotificationUserStates(notificationId: string, userIds: string[]) {
  return prisma.trNotificationUserState.createMany({
    data: Array.from(new Set(userIds)).map((userId) => ({ notificationId, userId })),
    skipDuplicates: true,
  });
}

export function findNotifications(
  userId: string,
  input: ListNotificationsInput
) {
  return prisma.trNotification.findMany({
    where: {
      ...(input.type && { type: input.type }),
      ...(input.homeId
        ? { homeId: input.homeId, home: { members: { some: { userId } } } }
        : { userId }),
    },
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 50,
    include: {
      home: { select: { id: true, name: true } },
      device: { select: { id: true, deviceId: true, name: true } },
      states: { where: { userId }, take: 1 },
      responses: { orderBy: { createdAt: "asc" } },
    },
  });
}

export function createNotification(input: CreateNotificationInput) {
  const metadata =
    input.metadata === undefined || input.metadata === null
      ? undefined
      : (input.metadata as Prisma.InputJsonValue);

  return prisma.trNotification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      homeId: input.homeId ?? null,
      deviceId: input.deviceId ?? null,
      metadata,
    },
  });
}

export function findAllDueFollowUpNotifications(now: Date) {
  return prisma.trNotification.findMany({
    where: { type: "alarm" },
    orderBy: { createdAt: "asc" },
    take: 50,
  }).then((notifications) =>
    notifications.filter((notification) => {
      const metadata = notification.metadata;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
      const record = metadata as Record<string, unknown>;
      if (typeof record.resolvedAt === "string") return false;
      if (typeof record.respondedAt === "string") return false;
      if (typeof record.followUpSentAt === "string") return false;
      if (typeof record.followUpAt !== "string") return false;
      return new Date(record.followUpAt).getTime() <= now.getTime();
    })
  );
}

export function findDueFollowUpNotifications(userId: string, now: Date) {
  return prisma.trNotification.findMany({
    where: {
      userId,
      type: "alarm",
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  }).then((notifications) =>
    notifications.filter((notification) => {
      const metadata = notification.metadata;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
      const record = metadata as Record<string, unknown>;
      if (typeof record.resolvedAt === "string") return false;
      if (typeof record.respondedAt === "string") return false;
      if (typeof record.followUpSentAt === "string") return false;
      if (typeof record.followUpAt !== "string") return false;
      return new Date(record.followUpAt).getTime() <= now.getTime();
    })
  );
}

export function findNotificationById(userId: string, notificationId: string) {
  return prisma.trNotification.findFirst({
    where: {
      id: notificationId,
      OR: [
        { userId },
        { home: { members: { some: { userId } } } },
      ],
    },
    include: {
      home: { select: { id: true, name: true } },
      device: { select: { id: true, deviceId: true, name: true } },
      states: { where: { userId }, take: 1 },
      responses: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function updateNotificationMetadata(
  userId: string,
  notificationId: string,
  metadata: Prisma.InputJsonValue
) {
  const result = await prisma.trNotification.updateMany({
    where: {
      id: notificationId,
      OR: [
        { userId },
        { home: { members: { some: { userId } } } },
      ],
    },
    data: { metadata },
  });
  if (result.count > 0) {
    await upsertNotificationUserState(notificationId, userId, { readAt: new Date() });
  }
  return result;
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await findNotificationById(userId, notificationId);
  if (!notification) return null;
  return upsertNotificationUserState(notificationId, userId, { readAt: new Date() });
}

export async function markAllNotificationsRead(userId: string) {
  const notifications = await prisma.trNotification.findMany({
    where: {
      OR: [
        { userId },
        { home: { members: { some: { userId } } } },
      ],
    },
    select: { id: true },
  });
  await Promise.all(
    notifications.map((notification) =>
      upsertNotificationUserState(notification.id, userId, { readAt: new Date() })
    )
  );
}
