import type { NotificationPreferenceInput } from "./notifications.validation";
import { getMessaging } from "@/config/firebase";
import {
  createNotification,
  findOrCreateNotificationPreference,
  findNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreference,
} from "./notifications.repository";
import type {
  CreateNotificationInput,
  ListNotificationsInput,
} from "./notifications.validation";

type NotificationPreferenceRecord = Awaited<ReturnType<typeof findOrCreateNotificationPreference>>;

function metadataValue(metadata: unknown, key: string): unknown {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  return (metadata as Record<string, unknown>)[key];
}

function shouldSendSystemNotification(
  preference: NotificationPreferenceRecord,
  input: CreateNotificationInput
) {
  if (!preference.systemNotificationEnabled) return false;
  if (preference.dndEnabled) return false;

  const eventType = metadataValue(input.metadata, "eventType");
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
  if (!messaging || !preference.fcmToken) return;
  if (!shouldSendSystemNotification(preference, input)) return;

  const severity = String(metadataValue(input.metadata, "severity") ?? "normal");
  const channelId = severity === "critical" ? "critical_alerts" : "eldora_alerts";
  const sound = String(metadataValue(input.metadata, "sound") ?? "default");

  try {
    await messaging.send({
      token: preference.fcmToken,
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
        priority: severity === "critical" ? "high" : "normal",
        notification: {
          channelId,
          sound,
          priority: severity === "critical" ? "max" : "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound,
            interruptionLevel: severity === "critical" ? "critical" : "active",
          },
        },
      },
    });
  } catch (error) {
    console.warn("[Notifications] FCM delivery failed:", error);
  }
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
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    home: notification.home,
    device: notification.device,
  };
}

export async function listUserNotifications(
  userId: string,
  input: ListNotificationsInput
) {
  const notifications = await findNotifications(userId, input);
  return notifications.map(toNotificationResponse);
}

export async function createUserNotification(input: CreateNotificationInput) {
  const notification = await createNotification(input);
  const preference = await findOrCreateNotificationPreference(input.userId);
  await sendFcmNotification(preference, notification.id, input);
  return notification;
}

export async function readUserNotification(
  userId: string,
  notificationId: string
) {
  await markNotificationRead(userId, notificationId);
}

export async function readAllUserNotifications(userId: string) {
  await markAllNotificationsRead(userId);
}
