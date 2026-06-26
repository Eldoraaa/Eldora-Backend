import { findDevicesByUser } from "@/modules/devices/devices.repository";
import { getVoiceLogsInRange, getNotificationsInRange } from "./analytics.repository";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function metaString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const val = (metadata as Record<string, unknown>)[key];
  return typeof val === "string" ? val : null;
}

function buildDayMap(from: Date, to: Date): Record<string, object> {
  const map: Record<string, object> = {};
  const cur = new Date(from);
  while (cur <= to) {
    map[dateKey(cur)] = {};
    cur.setDate(cur.getDate() + 1);
  }
  return map;
}

export async function getElderAnalytics(
  userId: string,
  from: Date,
  to: Date,
  homeId?: string | null,
  deviceId?: string | null
) {
  const devices = await findDevicesByUser(userId, homeId);
  const deviceIds = devices.map((d) => d.id);
  const selectedDeviceIds = deviceId
    ? deviceIds.includes(deviceId)
      ? [deviceId]
      : []
    : deviceIds;

  const selectedDeviceId = deviceId && selectedDeviceIds.length > 0 ? deviceId : null;

  const [voiceLogs, notifications] = await Promise.all([
    selectedDeviceIds.length > 0
      ? getVoiceLogsInRange(selectedDeviceIds, from, to)
      : Promise.resolve([]),
    deviceId && !selectedDeviceId
      ? Promise.resolve([])
      : getNotificationsInRange(userId, from, to, homeId, selectedDeviceId),
  ]);

  // ── Voice per day ─────────────────────────────────────────────────────────
  const voiceDayMap = buildDayMap(from, to) as Record<
    string,
    { total: number; distressed: number; anxious: number; sad: number; happy: number; calm: number; neutral: number }
  >;
  for (const key of Object.keys(voiceDayMap)) {
    voiceDayMap[key] = { total: 0, distressed: 0, anxious: 0, sad: 0, happy: 0, calm: 0, neutral: 0 };
  }

  const hourCount: Record<number, number> = {};
  const intentCount: Record<string, number> = {};
  let totalLatencyMs = 0;
  let latencyCount = 0;

  for (const log of voiceLogs) {
    const key = dateKey(log.createdAt);
    if (!voiceDayMap[key]) continue;
    const day = voiceDayMap[key];
    day.total += 1;
    const state = log.emotionState as string;
    if (state in day) (day as Record<string, number>)[state] += 1;

    const hour = log.createdAt.getHours();
    hourCount[hour] = (hourCount[hour] ?? 0) + 1;

    if (log.intent) {
      intentCount[log.intent] = (intentCount[log.intent] ?? 0) + 1;
    }
    if (log.latencyMs != null) {
      totalLatencyMs += log.latencyMs;
      latencyCount += 1;
    }
  }

  const voicePerDay = Object.entries(voiceDayMap).map(([date, v]) => ({ date, ...v }));

  // ── Active hours ──────────────────────────────────────────────────────────
  const activeHours = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: hourCount[h] ?? 0,
  }));

  // ── Alerts per day ────────────────────────────────────────────────────────
  const alertDayMap = buildDayMap(from, to) as Record<
    string,
    { falls: number; sos: number; voice: number; device: number; other: number }
  >;
  for (const key of Object.keys(alertDayMap)) {
    alertDayMap[key] = { falls: 0, sos: 0, voice: 0, device: 0, other: 0 };
  }

  let totalResponseTimeMs = 0;
  let responseTimeCount = 0;
  let resolvedCount = 0;

  for (const notif of notifications) {
    const key = dateKey(notif.createdAt);
    if (!alertDayMap[key]) continue;
    const day = alertDayMap[key];

    const eventType = metaString(notif.metadata, "eventType") ?? "";
    if (eventType === "fall_detected") day.falls += 1;
    else if (eventType === "sos") day.sos += 1;
    else if (eventType.startsWith("voice_")) day.voice += 1;
    else if (notif.type === "device") day.device += 1;
    else day.other += 1;

    const firstResponse = notif.responses[0];
    if (firstResponse) {
      totalResponseTimeMs +=
        firstResponse.createdAt.getTime() - notif.createdAt.getTime();
      responseTimeCount += 1;
      resolvedCount += 1;
    }
  }

  const alertsPerDay = Object.entries(alertDayMap).map(([date, v]) => ({ date, ...v }));

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalVoice = voiceLogs.length;
  const totalFalls = notifications.filter(
    (n) => metaString(n.metadata, "eventType") === "fall_detected"
  ).length;
  const totalSos = notifications.filter(
    (n) => metaString(n.metadata, "eventType") === "sos"
  ).length;
  const totalAlerts = notifications.length;
  const avgResponseTimeMs =
    responseTimeCount > 0
      ? Math.round(totalResponseTimeMs / responseTimeCount)
      : null;
  const avgLatencyMs =
    latencyCount > 0 ? Math.round(totalLatencyMs / latencyCount) : null;

  // ── Dominant emotion ──────────────────────────────────────────────────────
  const emotionTotals = { distressed: 0, anxious: 0, sad: 0, happy: 0, calm: 0, neutral: 0 };
  for (const log of voiceLogs) {
    const s = log.emotionState as keyof typeof emotionTotals;
    if (s in emotionTotals) emotionTotals[s] += 1;
  }
  const dominantEmotion =
    totalVoice > 0
      ? (Object.entries(emotionTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral")
      : null;

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      voiceInteractions: totalVoice,
      falls: totalFalls,
      sos: totalSos,
      alerts: totalAlerts,
      resolvedAlerts: resolvedCount,
    },
    avgResponseTimeMs,
    avgVoiceLatencyMs: avgLatencyMs,
    dominantEmotion,
    emotionTotals,
    voicePerDay,
    alertsPerDay,
    intentBreakdown: intentCount,
    activeHours,
    generatedAt: new Date().toISOString(),
  };
}
