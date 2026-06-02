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

export function findNotifications(
  userId: string,
  input: ListNotificationsInput
) {
  return prisma.trNotification.findMany({
    where: {
      userId,
      ...(input.type && { type: input.type }),
    },
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 50,
    include: {
      home: { select: { id: true, name: true } },
      device: { select: { id: true, deviceId: true, name: true } },
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

export function markNotificationRead(userId: string, notificationId: string) {
  return prisma.trNotification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export function markAllNotificationsRead(userId: string) {
  return prisma.trNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
