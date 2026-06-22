import { AppError } from "@/shared/errors";
import type { NotificationPreferenceInput } from "./notifications.validation";
import { getMessaging } from "@/config/firebase";
import {
  createNotification,
  createNotificationResponse,
  createNotificationUserStates,
  deleteNotificationDeviceToken,
  findAllDueFollowUpNotifications,
  findNotificationDeviceTokens,
  findDueFollowUpNotifications,
  findNotificationById,
  findOrCreateNotificationPreference,
  findNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationMetadata,
  updateNotificationPreference,
  upsertNotificationDeviceToken,
} from "./notifications.repository";
import type {
  CreateNotificationInput,
  ListNotificationsInput,
} from "./notifications.validation";
import type { z } from "zod";
import { respondNotificationSchema } from "./notifications.validation";
import { findHomeMemberUserIds } from "@/modules/home/home.repository";

type NotificationPreferenceRecord = Awaited<ReturnType<typeof findOrCreateNotificationPreference>>;

function metadataValue(metadata: unknown, key: string): unknown {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  return (metadata as Record<string, unknown>)[key];
}

function isWithinDndWindow(preference: NotificationPreferenceRecord) {
  if (!preference.dndEnabled) return false;
  if (!preference.dndStartTime || !preference.dndEndTime) return true;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = preference.dndStartTime.split(":").map(Number);
  const [endHour, endMinute] = preference.dndEndTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return start <= end ? current >= start && current <= end : current >= start || current <= end;
}

function shouldSendSystemNotification(
  preference: NotificationPreferenceRecord,
  input: CreateNotificationInput
) {
  if (!preference.systemNotificationEnabled) return false;

  const eventType = metadataValue(input.metadata, "eventType");
  const severity = metadataValue(input.metadata, "severity");
  const criticalBypass = severity === "critical" || eventType === "fall_detected" || eventType === "sos";
  if (!criticalBypass && isWithinDndWindow(preference)) return false;

  if (eventType === "sos") return preference.deviceAlertEnabled && preference.sosAlertEnabled;
  if (eventType === "low_battery") return preference.deviceAlertEnabled && preference.lowBatteryAlertEnabled;
  if (eventType === "bulletin") return preference.bulletinEnabled;
  if (input.type === "alarm") return preference.deviceAlertEnabled && preference.fallAlertEnabled;
  if (input.type === "device") {
    if (eventType === "device_offline") {
      return preference.deviceAlertEnabled && preference.deviceOfflineAlertEnabled;
    }
    return preference.deviceAlertEnabled;
  }
  if (input.type === "home") {
    if (eventType === "pairing_request") return preference.homeAlertEnabled && preference.pairingRequestAlertEnabled;
    return preference.homeAlertEnabled;
  }

  return true;
}

async function sendFcmNotification(
  preference: NotificationPreferenceRecord,
  notificationId: string,
  input: CreateNotificationInput
) {
  const messaging = getMessaging();
  if (!messaging) return;
  if (!shouldSendSystemNotification(preference, input)) return;

  const savedTokens = await findNotificationDeviceTokens(preference.userId);
  const tokens = Array.from(
    new Set([
      ...savedTokens.map((item) => item.token),
      ...(preference.fcmToken ? [preference.fcmToken] : []),
    ])
  );
  if (tokens.length === 0) return;

  const severity = String(metadataValue(input.metadata, "severity") ?? "normal");
  const isCritical = severity === "critical";
  const channelId = isCritical ? "critical_alerts" : "eldora_alerts";
  const sound = String(metadataValue(input.metadata, "sound") ?? "default");

  await Promise.all(
    tokens.map(async (token) => {
      try {
        await messaging.send({
          token,
          notification: {
            title: input.title,
            body: input.body ?? undefined,
          },
          data: {
            notificationId,
            type: input.type,
            homeId: input.homeId ?? "",
            deviceId: input.deviceId ?? "",
            severity,
          },
          android: {
            priority: isCritical ? "high" : "normal",
            ttl: isCritical ? 60 * 60 * 1000 : undefined,
            notification: {
              channelId,
              sound,
              priority: isCritical ? "max" : "default",
              visibility: "public",
              defaultVibrateTimings: isCritical,
              defaultSound: true,
            },
          },
          apns: {
            headers: {
              "apns-priority": isCritical ? "10" : "5",
            },
            payload: {
              aps: {
                sound: isCritical ? { critical: true, name: sound, volume: 1 } : sound,
                interruptionLevel: isCritical ? "critical" : "active",
              },
            },
          },
        });
      } catch (error) {
        const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          await deleteNotificationDeviceToken(token);
          if (token === preference.fcmToken) {
            await updateNotificationPreference(preference.userId, {
              fcmToken: null,
              fcmPlatform: null,
            });
          }
        }
        console.warn("[Notifications] FCM delivery failed:", error);
      }
    })
  );
}

function toPreferenceResponse(preference: Awaited<ReturnType<typeof findOrCreateNotificationPreference>>) {
  return {
    id: preference.id,
    deviceAlertEnabled: preference.deviceAlertEnabled,
    dndEnabled: preference.dndEnabled,
    dndStartTime: preference.dndStartTime,
    dndEndTime: preference.dndEndTime,
    systemNotificationEnabled: preference.systemNotificationEnabled,
    homeAlertEnabled: preference.homeAlertEnabled,
    fallAlertEnabled: preference.fallAlertEnabled,
    sosAlertEnabled: preference.sosAlertEnabled,
    deviceOfflineAlertEnabled: preference.deviceOfflineAlertEnabled,
    lowBatteryAlertEnabled: preference.lowBatteryAlertEnabled,
    pairingRequestAlertEnabled: preference.pairingRequestAlertEnabled,
    bulletinEnabled: preference.bulletinEnabled,
    fcmToken: preference.fcmToken,
    fcmPlatform: preference.fcmPlatform,
    updatedAt: preference.updatedAt,
  };
}

export async function getNotificationPreference(userId: string) {
  const preference = await findOrCreateNotificationPreference(userId);
  return toPreferenceResponse(preference);
}

export async function saveNotificationPreference(
  userId: string,
  input: NotificationPreferenceInput
) {
  const preference = await updateNotificationPreference(userId, input);
  if (input.fcmToken) {
    await upsertNotificationDeviceToken({
      userId,
      token: input.fcmToken,
      platform: input.fcmPlatform,
    });
  }
  return toPreferenceResponse(preference);
}

type NotificationRecord = Awaited<ReturnType<typeof findNotifications>>[number];

function toNotificationResponse(notification: NotificationRecord) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    metadata: notification.metadata,
    readAt: "states" in notification && notification.states?.[0] ? notification.states[0].readAt : notification.readAt,
    createdAt: notification.createdAt,
    home: notification.home,
    device: notification.device,
    responses: "responses" in notification ? notification.responses : [],
  };
}

async function sendDueFollowUps(
  dueNotifications: Awaited<ReturnType<typeof findDueFollowUpNotifications>>
) {
  await Promise.all(
    dueNotifications.map(async (notification) => {
      const metadata = metadataValue(notification.metadata, "followUpAt")
        ? (notification.metadata as Record<string, unknown>)
        : {};
      await createUserNotification({
        userId: notification.userId,
        type: "alarm",
        title: "No response yet",
        body: "An Eldora alert has not been resolved. Please check immediately.",
        homeId: notification.homeId,
        deviceId: notification.deviceId,
        metadata: {
          eventType: "alert_follow_up",
          severity: "warning",
          sourceNotificationId: notification.id,
          occurredAt: new Date().toISOString(),
          showCallAction: true,
          followUpAt: null,
        },
      });
      await updateNotificationMetadata(notification.userId, notification.id, {
        ...metadata,
        followUpSentAt: new Date().toISOString(),
      });
    })
  );
}

async function processDueFollowUps(userId: string) {
  await sendDueFollowUps(await findDueFollowUpNotifications(userId, new Date()));
}

export async function processAllDueFollowUps() {
  await sendDueFollowUps(await findAllDueFollowUpNotifications(new Date()));
}

export async function getUserNotification(userId: string, notificationId: string) {
  const notification = await findNotificationById(userId, notificationId);
  if (!notification) throw new AppError("Notification not found", 404);
  return toNotificationResponse(notification);
}

export async function listUserNotifications(
  userId: string,
  input: ListNotificationsInput
) {
  await processDueFollowUps(userId);
  const notifications = await findNotifications(userId, input);
  return notifications.map(toNotificationResponse);
}

export async function createUserNotification(input: CreateNotificationInput) {
  const notification = await createNotification(input);
  await createNotificationUserStates(notification.id, [input.userId]);
  const preference = await findOrCreateNotificationPreference(input.userId);
  await sendFcmNotification(preference, notification.id, input);
  return notification;
}

export async function createHomeNotification(input: Omit<CreateNotificationInput, "userId"> & { homeId: string; userId?: string }) {
  const memberIds = await findHomeMemberUserIds(input.homeId);
  if (memberIds.length === 0 && !input.userId) throw new AppError("Home has no members", 400);
  const notification = await createNotification({
    ...input,
    userId: input.userId || memberIds[0]!,
  });
  await createNotificationUserStates(notification.id, memberIds);
  await Promise.all(
    memberIds.map(async (userId) => {
      const preference = await findOrCreateNotificationPreference(userId);
      await sendFcmNotification(preference, notification.id, { ...input, userId });
    })
  );
  return notification;
}

export async function readUserNotification(
  userId: string,
  notificationId: string
) {
  await markNotificationRead(userId, notificationId);
}

export async function respondToUserNotification(
  userId: string,
  notificationId: string,
  input: z.infer<typeof respondNotificationSchema>
) {
  const notification = await findNotificationById(userId, notificationId);
  if (!notification) throw new AppError("Notification not found", 404);

  const metadata =
    notification.metadata &&
    typeof notification.metadata === "object" &&
    !Array.isArray(notification.metadata)
      ? notification.metadata
      : {};
  const now = new Date().toISOString();

  await createNotificationResponse({
    notificationId,
    userId,
    status: input.status,
    note: input.note ?? null,
  });

  await updateNotificationMetadata(userId, notificationId, {
    ...metadata,
    responseStatus: input.status,
    responseNote: input.note ?? null,
    respondedAt: now,
    lastResponseStatus: input.status,
    lastResponderId: userId,
    followUpStoppedAt: now,
    ...(input.status === "resolved" ? { resolvedAt: now, resolvedBy: userId } : {}),
  });
}

export async function resolveUserNotification(
  userId: string,
  notificationId: string
) {
  const notification = await findNotificationById(userId, notificationId);
  if (!notification) throw new AppError("Notification not found", 404);

  const metadata =
    notification.metadata &&
    typeof notification.metadata === "object" &&
    !Array.isArray(notification.metadata)
      ? notification.metadata
      : {};

  const now = new Date().toISOString();

  await updateNotificationMetadata(userId, notificationId, {
    ...metadata,
    responseStatus: "resolved",
    lastResponseStatus: "resolved",
    lastResponderId: userId,
    respondedAt: typeof metadata.respondedAt === "string" ? metadata.respondedAt : now,
    resolvedAt: now,
    resolvedBy: userId,
    followUpStoppedAt: now,
  });
}

export async function readAllUserNotifications(userId: string) {
  await markAllNotificationsRead(userId);
}
