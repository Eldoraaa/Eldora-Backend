import axios from "axios";
import { prisma } from "@/config/database";
import { getMessaging } from "@/config/firebase";

interface NotifyPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

const EXPO_PUSH_URL = "https://exp.host/--/expoapi/v2/push/send";
const EXPO_TOKEN_PREFIX = "ExponentPushToken[";

export async function sendAlertNotification(
  tokens: string[],
  alertId: string,
  payload: NotifyPayload
): Promise<void> {
  if (tokens.length === 0) return;

  const expoTokens = tokens.filter((t) => t.startsWith(EXPO_TOKEN_PREFIX));
  const nativeTokens = tokens.filter((t) => !t.startsWith(EXPO_TOKEN_PREFIX));

  const [expoBatch, nativeBatch] = await Promise.allSettled([
    sendViaExpo(expoTokens, alertId, payload),
    sendViaFirebase(nativeTokens, alertId, payload),
  ]);

  if (expoBatch.status === "rejected") {
    console.error("[Notification] Expo send failed:", expoBatch.reason);
  }
  if (nativeBatch.status === "rejected") {
    console.error("[Notification] Firebase send failed:", nativeBatch.reason);
  }
}

async function sendViaExpo(
  tokens: string[],
  alertId: string,
  payload: NotifyPayload
): Promise<void> {
  if (tokens.length === 0) return;

  const BATCH_SIZE = 100;
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const messages = batch.map((token) => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: { alertId, ...payload.data },
      sound: "default",
    }));

    try {
      const { data } = await axios.post<{ data: Array<{ status: string; message?: string }> }>(
        EXPO_PUSH_URL,
        messages,
        { headers: { "Content-Type": "application/json" } }
      );

      const failedTokens: string[] = [];
      data.data.forEach((ticket, idx) => {
        if (ticket.status === "error") {
          failedTokens.push(batch[idx]);
        }
      });

      await updateDeliveryStatus(batch, alertId, "sent");
      if (failedTokens.length > 0) {
        await updateDeliveryStatus(failedTokens, alertId, "failed");
      }
    } catch (err) {
      console.error("[Notification] Expo batch failed:", err);
      await updateDeliveryStatus(batch, alertId, "failed");
    }
  }
}

async function sendViaFirebase(
  tokens: string[],
  alertId: string,
  payload: NotifyPayload
): Promise<void> {
  if (tokens.length === 0) return;

  const messaging = getMessaging();
  if (!messaging) {
    console.warn("[Notification] Firebase not configured — skipping native tokens");
    await updateDeliveryStatus(tokens, alertId, "failed");
    return;
  }

  try {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: { alertId, ...payload.data },
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        if (resp.error?.code === "messaging/registration-token-not-registered") {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    const sentTokens = tokens.filter((t) => !invalidTokens.includes(t));
    await Promise.all([
      updateDeliveryStatus(sentTokens, alertId, "sent"),
      updateDeliveryStatus(invalidTokens, alertId, "failed"),
      // Auto-delete invalid tokens
      invalidTokens.length > 0
        ? prisma.notificationToken.deleteMany({ where: { fcmToken: { in: invalidTokens } } })
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("[Notification] Firebase multicast failed:", err);
    await updateDeliveryStatus(tokens, alertId, "failed");
  }
}

async function updateDeliveryStatus(
  tokens: string[],
  alertId: string,
  status: "sent" | "failed"
): Promise<void> {
  if (tokens.length === 0) return;

  const userIds = await prisma.notificationToken
    .findMany({ where: { fcmToken: { in: tokens } }, select: { userId: true } })
    .then((rows) => rows.map((r) => r.userId));

  await prisma.alertRecipient.updateMany({
    where: { alertId, userId: { in: userIds } },
    data: { deliveryStatus: status },
  });
}
