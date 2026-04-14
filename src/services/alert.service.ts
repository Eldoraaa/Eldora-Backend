import { EventType, AlertPriority } from "../../generated/prisma/client";
import { prisma } from "@/config/database";
import { sendAlertNotification } from "./notification.service";

const PRIORITY_MAP: Record<EventType, AlertPriority> = {
  emergency: "critical",
  assistance_request: "high",
  sensor_anomaly: "high",
  service_request: "medium",
  device_status: "low",
};

const TITLE_MAP: Record<EventType, string> = {
  emergency: "🚨 Darurat! Butuh Bantuan Segera",
  assistance_request: "🙋 Permintaan Bantuan",
  sensor_anomaly: "⚠️ Anomali Sensor Terdeteksi",
  service_request: "📋 Permintaan Layanan",
  device_status: "📴 Perangkat Offline",
};

function buildDescription(eventType: EventType, payload: Record<string, unknown>): string {
  const detail = payload.detail ?? payload.message ?? "";
  switch (eventType) {
    case "emergency":
      return `Tombol darurat ditekan${detail ? ": " + detail : ""}. Segera periksa kondisi.`;
    case "assistance_request":
      return `Membutuhkan bantuan${detail ? ": " + detail : ""}. Mohon segera ditangani.`;
    case "sensor_anomaly":
      return `Sensor mendeteksi kondisi tidak normal${detail ? ": " + detail : ""}.`;
    case "service_request":
      return `Ada permintaan layanan${detail ? ": " + detail : ""}.`;
    case "device_status":
      return `Perangkat terputus dari jaringan dan tidak dapat dipantau.`;
    default:
      return String(detail);
  }
}

function shouldCreateAlert(eventType: EventType, payload: Record<string, unknown>): boolean {
  if (eventType === "device_status") {
    return payload.status === "offline";
  }
  return true;
}

export async function processDeviceEvent(
  deviceEventId: string,
  eventType: EventType,
  payload: Record<string, unknown>,
  elderProfileId: string
): Promise<void> {
  if (!shouldCreateAlert(eventType, payload)) return;

  const priority = PRIORITY_MAP[eventType];
  const title = TITLE_MAP[eventType];
  const description = buildDescription(eventType, payload);

  const alert = await prisma.alert.create({
    data: {
      title,
      description,
      priority,
      deviceEventId,
    },
  });

  // Get all users connected to this elder profile + their tokens
  const elderProfile = await prisma.elderProfile.findUnique({
    where: { id: elderProfileId },
    include: {
      users: {
        include: {
          notificationTokens: { select: { fcmToken: true } },
        },
      },
    },
  });

  if (!elderProfile || elderProfile.users.length === 0) return;

  const userIds = elderProfile.users.map((u) => u.id);
  const allTokens = elderProfile.users.flatMap((u) =>
    u.notificationTokens.map((nt) => nt.fcmToken)
  );

  await prisma.alertRecipient.createMany({
    data: userIds.map((userId) => ({ alertId: alert.id, userId })),
    skipDuplicates: true,
  });

  // Fire-and-forget
  sendAlertNotification(allTokens, alert.id, { title, body: description }).catch((err) =>
    console.error("[Alert] Notification failed:", err)
  );
}
