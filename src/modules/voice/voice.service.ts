import { config } from "@/config";
import { createDeviceCommand } from "@/modules/iot/iot.repository";
import { createHomeNotification, createUserNotification } from "@/modules/notifications/notifications.service";
import { findEnabledScheduleScenes } from "@/modules/scenes/scenes.repository";
import { findDeviceById, findDevicesByUser } from "@/modules/devices/devices.repository";
import { findOrCreateDeviceVoiceConfig } from "@/modules/devices/voice-config.repository";
import { AppError } from "@/shared/errors";
import { DeviceCommandType, ElderReminderStatus, VoiceEmotionState } from "../../../generated/prisma/client";
import {
  createElderReminder,
  createSceneReminderDelivery,
  createVoiceConversationTurn,
  createVoiceEmotionLog,
  failExpiredQueuedReminders,
  findDueElderReminders,
  findElderReminderDetailForUser,
  findElderReminderForUser,
  findElderRemindersForUser,
  findMemoryFactForUser,
  findMemoryFactsForUser,
  findRecentSceneReminderDelivery,
  findVoiceContext,
  SceneReminderDeliveryMode,
  upsertElderContextSummary,
  upsertElderMemoryFact,
  updateElderReminderStatus,
  updateMemoryFactStatus,
} from "./voice.repository";
import type { ProcessVoiceTextInput } from "./voice.validation";

type VoiceIntent =
  | "ignored"
  | "check_in"
  | "emergency_help"
  | "fall_emergency"
  | "call_caregiver"
  | "call_family"
  | "request_water"
  | "request_medicine"
  | "request_object"
  | "comfort"
  | "conversation";

type IntentResult = {
  intent: VoiceIntent;
  confidence: number;
  ignored: boolean;
  reason?: "no_wake_phrase" | "low_confidence";
  responseText?: string;
  notification?: {
    type: "alarm" | "home";
    title: string;
    body: string;
    severity: "normal" | "warning" | "critical";
    eventType: string;
  };
};

type VoiceReminderPlan = {
  action?: string;
  title?: string | null;
  message?: string | null;
  due_at?: string | null;
  dueAt?: string | null;
  timezone?: string | null;
  recurrence_rule?: string | null;
  recurrenceRule?: string | null;
  confidence?: number;
  clarification_question?: string | null;
  clarificationQuestion?: string | null;
};

const WAKE_PHRASES = ["eldora", "el dora"];
const EMERGENCY_WORDS = ["help", "i fell", "fell down", "fallen", "emergency", "call my family", "call my caregiver", "call someone"];

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function hasWakePhrase(text: string) {
  return includesAny(text, WAKE_PHRASES);
}

function hasEmergencyOverride(text: string) {
  return includesAny(text, EMERGENCY_WORDS);
}

function reminderDueAt(plan: VoiceReminderPlan) {
  const raw = plan.dueAt ?? plan.due_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function reminderRecurrence(plan: VoiceReminderPlan) {
  return plan.recurrenceRule ?? plan.recurrence_rule ?? null;
}

function reminderTitle(plan: VoiceReminderPlan) {
  return (plan.title ?? plan.message ?? "DoraBot reminder").trim().slice(0, 120) || "DoraBot reminder";
}

function reminderDisplayTime(dueAt: Date, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(dueAt);
}

function reminderTimeOnly(dueAt: Date, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(dueAt);
}

function reminderSpeechText(message: string, dueAt: Date, timezone: string, elderName?: string | null) {
  const name = elderName ? ` ${elderName}` : "";
  const time = reminderTimeOnly(dueAt, timezone);
  const cleaned = message.trim().replace(/[.!?]+$/, "");
  return `Permisi${name}, ini pengingat dari Eldora. Jangan lupa, jam ${time} ada ${cleaned}. Kalau sudah selesai, tidak apa-apa, semoga harimu tetap nyaman ya.`;
}

async function notifyReminderCreated(input: {
  reminderId: string;
  device: Awaited<ReturnType<typeof findDeviceById>>;
  homeId?: string | null;
  message: string;
  dueAt: Date;
  timezone: string;
}) {
  const elderName = input.device.elderProfile.name;
  const body = `${elderName} asked DoraBot to remind them: ${input.message} (${reminderDisplayTime(input.dueAt, input.timezone)}).`;
  const metadata = {
    eventType: "elder_voice_reminder_created",
    severity: "normal",
    sound: null,
    sceneId: null,
    reminderId: input.reminderId,
    deviceId: input.device.id,
    dueAt: input.dueAt.toISOString(),
    timezone: input.timezone,
    showCallAction: false,
    followUpAt: null,
  };

  if (input.homeId) {
    await createHomeNotification({
      type: "home",
      title: "New DoraBot reminder",
      body,
      homeId: input.homeId,
      deviceId: input.device.id,
      metadata,
    });
    return;
  }

  await Promise.all(
    input.device.elderProfile.userLinks.map((link) =>
      createUserNotification({
        userId: link.userId,
        type: "home",
        title: "New DoraBot reminder",
        body,
        homeId: null,
        deviceId: input.device.id,
        metadata,
      })
    )
  );
}

function trimContext(value: string, max = 700) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

async function buildVoiceContextHeader(elderProfileId: string) {
  const context = await Promise.race([
    findVoiceContext(elderProfileId),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
  ]);
  if (!context) return "";
  const parts: string[] = [];
  if (context.summary?.summary) parts.push(`Summary: ${context.summary.summary}`);
  if (context.summary?.preferenceSummary) parts.push(`Preferences: ${context.summary.preferenceSummary}`);
  if (context.facts.length > 0) {
    parts.push(`Facts: ${context.facts.map((fact) => `${fact.key}: ${fact.value}`).join("; ")}`);
  }
  if (context.recentTurns.length > 0) {
    parts.push(
      `Recent: ${context.recentTurns
        .map((turn) => `Elder: ${turn.transcript}${turn.responseText ? ` | Eldora: ${turn.responseText}` : ""}`)
        .join("; ")}`
    );
  }
  return trimContext(parts.join("\n"));
}

async function extractSimpleMemoryFact(input: {
  elderProfileId: string;
  transcript: string;
  turnId?: string | null;
}) {
  const text = input.transcript.trim();
  const lower = text.toLowerCase();
  const facts: Array<{ type: string; key: string; value: string; confidence: number; status?: string }> = [];

  const daughterMatch = text.match(/(?:anak|putri|daughter)(?: saya|ku)?(?: bernama| namanya| is named| is)?\s+([A-ZÀ-ÿ][\wÀ-ÿ'-]{1,30})/i);
  if (daughterMatch?.[1]) {
    facts.push({ type: "family", key: "daughter_name", value: daughterMatch[1], confidence: 0.82, status: "confirmed" });
  }

  const sonMatch = text.match(/(?:anak laki-laki|putra|son)(?: saya|ku)?(?: bernama| namanya| is named| is)?\s+([A-ZÀ-ÿ][\wÀ-ÿ'-]{1,30})/i);
  if (sonMatch?.[1]) {
    facts.push({ type: "family", key: "son_name", value: sonMatch[1], confidence: 0.82, status: "confirmed" });
  }

  const likesMatch = text.match(/(?:saya suka|aku suka|i like|i love)\s+(.{3,80})/i);
  if (likesMatch?.[1]) {
    facts.push({ type: "preference", key: `likes_${likesMatch[1].toLowerCase().replace(/\W+/g, "_").slice(0, 32)}`, value: likesMatch[1].trim(), confidence: 0.72 });
  }

  const routineMatch = text.match(/(?:biasanya|usually|setiap hari|tiap hari)\s+(.{5,100})/i);
  if (routineMatch?.[1]) {
    facts.push({ type: "routine", key: `routine_${routineMatch[1].toLowerCase().replace(/\W+/g, "_").slice(0, 32)}`, value: routineMatch[1].trim(), confidence: 0.66 });
  }

  if (/(obat|medicine|insulin|darah tinggi|diabetes|nyeri dada|chest pain|jatuh|fell|fall)/i.test(text)) {
    facts.push({ type: "safety", key: `safety_${Date.now()}`, value: text.slice(0, 180), confidence: 0.58, status: "candidate" });
  }

  await Promise.all(
    facts.map((fact) =>
      upsertElderMemoryFact({
        elderProfileId: input.elderProfileId,
        type: fact.type,
        key: fact.key,
        value: fact.value,
        confidence: fact.confidence,
        status: fact.status,
        sourceTurnId: input.turnId ?? null,
      })
    )
  );

  if (facts.length > 0) {
    const preferenceSummary = facts
      .filter((fact) => fact.type === "preference" || fact.type === "routine" || fact.type === "family")
      .map((fact) => `${fact.key}: ${fact.value}`)
      .join("; ");
    const safetySummary = facts
      .filter((fact) => fact.type === "safety")
      .map((fact) => fact.value)
      .join("; ");
    await upsertElderContextSummary({
      elderProfileId: input.elderProfileId,
      ...(preferenceSummary ? { preferenceSummary } : {}),
      ...(safetySummary ? { safetySummary } : {}),
      summary: lower.includes("cemas") || lower.includes("anxious")
        ? "The elder may feel anxious and benefits from calm reassurance."
        : undefined,
    });
  }
}

async function saveReminderFromPlan(input: {
  plan: VoiceReminderPlan;
  device: Awaited<ReturnType<typeof findDeviceById>>;
  homeId?: string | null;
  turnId?: string | null;
}) {
  if (input.plan.action !== "create_reminder") return null;
  const dueAt = reminderDueAt(input.plan);
  if (!dueAt) return null;
  const message = (input.plan.message ?? input.plan.title ?? "DoraBot reminder").trim();
  if (!message) return null;
  const timezone = input.plan.timezone ?? "Asia/Jakarta";
  const title = reminderTitle(input.plan);
  const reminder = await createElderReminder({
    elderProfileId: input.device.elderProfileId,
    deviceId: input.device.id,
    homeId: input.homeId ?? null,
    title,
    message,
    dueAt,
    timezone,
    recurrenceRule: reminderRecurrence(input.plan),
    status: ElderReminderStatus.pending,
    createdFromTurnId: input.turnId ?? null,
  });
  await notifyReminderCreated({
    reminderId: reminder.id,
    device: input.device,
    homeId: input.homeId ?? null,
    message,
    dueAt,
    timezone,
  });
  return reminder;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function sceneActionSteps(actions: unknown) {
  const record = asRecord(actions);
  return Array.isArray(record.steps) ? record.steps.map(asRecord) : [];
}

function sceneScheduleTime(scene: Awaited<ReturnType<typeof findEnabledScheduleScenes>>[number]) {
  const condition = asRecord(asRecord(scene.triggerConfig).condition);
  const schedule = asRecord(condition.schedule);
  return typeof schedule.time === "string" ? schedule.time : null;
}

function sceneDeviceBindings(scene: Awaited<ReturnType<typeof findEnabledScheduleScenes>>[number]) {
  return {
    ...asRecord(asRecord(scene.triggerConfig).deviceBindings),
    ...asRecord(asRecord(scene.actions).deviceBindings),
  };
}

function reminderMessageFromScene(scene: Awaited<ReturnType<typeof findEnabledScheduleScenes>>[number]) {
  const step = sceneActionSteps(scene.actions).find((item) => {
    const type = item.type;
    return type === "speak_on_dorabot" || type === "dorabot_voice_check_in";
  });
  const message = step?.message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function isSceneReminderWindow(time: string, now: Date) {
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;
  const scheduled = new Date(now);
  scheduled.setHours(hour, minute, 0, 0);
  const delta = now.getTime() - scheduled.getTime();
  return delta >= -15 * 60 * 1000 && delta <= 30 * 60 * 1000;
}

async function findConversationSceneReminder(device: Awaited<ReturnType<typeof findDeviceById>>) {
  const homeId = device.roomCategory?.homeId;
  if (!homeId) return null;
  const now = new Date();
  const scenes = await findEnabledScheduleScenes();
  for (const scene of scenes) {
    if (scene.homeId !== homeId) continue;
    const time = sceneScheduleTime(scene);
    if (!time || !isSceneReminderWindow(time, now)) continue;
    const bindings = sceneDeviceBindings(scene);
    if (bindings.dorabot && bindings.dorabot !== device.id) continue;
    const message = reminderMessageFromScene(scene);
    if (!message) continue;
    const recent = await findRecentSceneReminderDelivery(
      scene.id,
      device.elderProfileId,
      new Date(now.getTime() - 12 * 60 * 60 * 1000)
    );
    if (recent) continue;
    return { scene, message };
  }
  return null;
}

export async function createDeviceSpeechPayload(deviceId: string, message: string, required = false) {
  if (!config.voiceAudioBaseUrl) {
    if (required) throw new AppError("Voice service is not configured", 501);
    return { message };
  }

  const voiceCfg = await findOrCreateDeviceVoiceConfig(deviceId);
  const response = await fetch(`${config.voiceAudioBaseUrl}/api/test-tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Voice-Enabled": String(voiceCfg.enabled),
      "X-Voice-Language": voiceCfg.language,
      "X-Voice-TTS-Voice": voiceCfg.ttsVoice,
      "X-Voice-Rate": voiceCfg.ttsRate,
    },
    body: JSON.stringify({ text: message }),
  });

  if (!response.ok) {
    if (required) throw new AppError("Voice test failed", 502);
    return { message };
  }

  const result = (await response.json()) as { audio_url?: string | null; audioUrl?: string | null };
  const audioUrl = result.audio_url ?? result.audioUrl ?? null;
  const absoluteAudioUrl = audioUrl && audioUrl.startsWith("/")
    ? `${config.voiceAudioBaseUrl}${audioUrl}`
    : audioUrl;

  return { message, audioUrl: absoluteAudioUrl };
}

function detectIntent(transcript: string, sttConfidence?: number): IntentResult {
  const text = normalize(transcript);
  const woke = hasWakePhrase(text);
  const emergencyOverride = hasEmergencyOverride(text);

  if (sttConfidence !== undefined && sttConfidence < 0.45 && !emergencyOverride) {
    return {
      intent: "ignored",
      confidence: sttConfidence,
      ignored: true,
      reason: "low_confidence",
      responseText: woke
        ? "I heard something, but I am not sure. Please say, Eldora, if you need me."
        : undefined,
    };
  }

  if (!woke && !emergencyOverride) {
    return {
      intent: "ignored",
      confidence: sttConfidence ?? 0.8,
      ignored: true,
      reason: "no_wake_phrase",
    };
  }

  if (text.includes("i fell") || text.includes("fell down") || text.includes("fallen")) {
    return {
      intent: "fall_emergency",
      confidence: 0.98,
      ignored: false,
      responseText: "I am contacting your caregiver now. Please stay calm and stay still if you can.",
      notification: {
        type: "alarm",
        title: "Fall help requested",
        body: "DoraBot heard a fall-related help request.",
        severity: "critical",
        eventType: "voice_fall_emergency",
      },
    };
  }

  if (
    text.includes("call my child") ||
    text.includes("call my son") ||
    text.includes("call my daughter") ||
    text.includes("call my family") ||
    text.includes("contact my family") ||
    text.includes("call my caregiver") ||
    text.includes("contact my caregiver") ||
    text.includes("call someone")
  ) {
    return {
      intent: "call_family",
      confidence: 0.95,
      ignored: false,
      responseText: "Okay. I will notify your family right now.",
      notification: {
        type: "alarm",
        title: "Family call requested",
        body: "The elder asked DoraBot to contact family or a caregiver.",
        severity: "critical",
        eventType: "voice_call_family",
      },
    };
  }

  if (text.includes("help") || text.includes("emergency")) {
    return {
      intent: "emergency_help",
      confidence: 0.92,
      ignored: false,
      responseText: "I am alerting your caregiver now. Please stay calm. Help is on the way.",
      notification: {
        type: "alarm",
        title: "Help requested",
        body: "The elder asked DoraBot for urgent help.",
        severity: "critical",
        eventType: "voice_emergency_help",
      },
    };
  }

  if (text.includes("water") || text.includes("drink") || text.includes("glass")) {
    return {
      intent: text.includes("water") || text.includes("drink") ? "request_water" : "request_object",
      confidence: 0.88,
      ignored: false,
      responseText: "Okay. I will let your caregiver know.",
      notification: {
        type: "alarm",
        title: "Care request",
        body: "The elder asked for help with water or a glass.",
        severity: "critical",
        eventType: "voice_service_request",
      },
    };
  }

  if (text.includes("medicine") || text.includes("medication") || text.includes("pill")) {
    return {
      intent: "request_medicine",
      confidence: 0.9,
      ignored: false,
      responseText: "Okay. I will let your caregiver know about your medicine request.",
      notification: {
        type: "alarm",
        title: "Medicine help requested",
        body: "The elder asked for help with medicine.",
        severity: "critical",
        eventType: "voice_medicine_request",
      },
    };
  }

  if (text.includes("are you there") || text.includes("can you hear me") || text === "eldora") {
    return {
      intent: "check_in",
      confidence: 0.9,
      ignored: false,
      responseText: "Yes, I am here with you. Are you feeling okay?",
    };
  }

  if (text.includes("lonely") || text.includes("scared") || text.includes("afraid") || text.includes("stay with me")) {
    return {
      intent: "comfort",
      confidence: 0.82,
      ignored: false,
      responseText: "I am here with you. Take a slow breath. You are not alone.",
    };
  }

  return {
    intent: "conversation",
    confidence: 0.65,
    ignored: false,
    responseText: "I am here. Please tell me what you need in a simple sentence.",
  };
}

export async function processVoiceText(input: ProcessVoiceTextInput) {
  const device = input.deviceId ? await findDeviceById(input.deviceId) : null;
  const result = detectIntent(input.transcript, input.confidence);

  if (result.ignored) {
    if (device && result.responseText) {
      await createDeviceCommand(device.id, DeviceCommandType.speak_on_dorabot, {
        source: "voice",
        intent: result.intent,
        ...(await createDeviceSpeechPayload(device.id, result.responseText)),
      });
    }

    return {
      ignored: true,
      reason: result.reason,
      transcript: input.transcript,
      intent: result.intent,
      confidence: result.confidence,
      responseText: result.responseText ?? null,
      action: null,
    };
  }

  if (device && result.responseText) {
    await createDeviceCommand(device.id, DeviceCommandType.speak_on_dorabot, {
      source: "voice",
      intent: result.intent,
      ...(await createDeviceSpeechPayload(device.id, result.responseText)),
    });
  }

  if (device && result.notification) {
    const homeId = device.roomCategory?.homeId;
    const notificationPayload = {
      type: result.notification.type,
      title: result.notification.title,
      body: result.notification.body,
      deviceId: device.id,
      metadata: {
        eventType: result.notification.eventType,
        severity: result.notification.severity,
        source: "voice",
        transcript: input.transcript,
        intent: result.intent,
        occurredAt: new Date().toISOString(),
        showCallAction: result.notification.type === "alarm",
        followUpAt: result.notification.type === "alarm" ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
      },
    };

    if (homeId) {
      await createHomeNotification({ ...notificationPayload, homeId });
    } else {
      const caregiverIds = device.elderProfile.userLinks.map((link) => link.userId);
      await Promise.all(
        caregiverIds.map((userId) =>
          createUserNotification({
            ...notificationPayload,
            userId,
            homeId: null,
          })
        )
      );
    }
  }

  if (!device && result.notification) {
    throw new AppError("A paired DoraBot device is required for voice alerts", 400);
  }

  return {
    ignored: false,
    transcript: input.transcript,
    intent: result.intent,
    confidence: result.confidence,
    responseText: result.responseText ?? null,
    action: result.notification ? "caregiver_notified" : "dorabot_response_queued",
  };
}

export async function listMemoryFacts(userId: string, status = "candidate") {
  return findMemoryFactsForUser(userId, status);
}

export async function approveMemoryFact(userId: string, factId: string) {
  const fact = await findMemoryFactForUser(userId, factId);
  if (!fact) throw new AppError("Memory fact not found", 404);
  return updateMemoryFactStatus(factId, "confirmed");
}

export async function rejectMemoryFact(userId: string, factId: string) {
  const fact = await findMemoryFactForUser(userId, factId);
  if (!fact) throw new AppError("Memory fact not found", 404);
  return updateMemoryFactStatus(factId, "rejected");
}

export async function listElderReminders(userId: string, homeId?: string | null) {
  return findElderRemindersForUser(userId, homeId);
}

export async function getElderReminder(userId: string, reminderId: string) {
  const reminder = await findElderReminderDetailForUser(userId, reminderId);
  if (!reminder) throw new AppError("Reminder not found", 404);
  return reminder;
}

export async function cancelElderReminder(userId: string, reminderId: string) {
  const reminder = await findElderReminderForUser(userId, reminderId);
  if (!reminder) throw new AppError("Reminder not found", 404);
  if (reminder.status === ElderReminderStatus.delivered || reminder.status === ElderReminderStatus.acknowledged) {
    throw new AppError("Reminder can no longer be cancelled", 400);
  }
  return updateElderReminderStatus(reminderId, {
    status: ElderReminderStatus.cancelled,
    cancelledAt: new Date(),
  });
}

export async function acknowledgeElderReminder(userId: string, reminderId: string) {
  const reminder = await findElderReminderForUser(userId, reminderId);
  if (!reminder) throw new AppError("Reminder not found", 404);
  return updateElderReminderStatus(reminderId, {
    status: ElderReminderStatus.acknowledged,
    acknowledgedAt: new Date(),
  });
}

export async function processDueElderReminders() {
  const now = new Date();
  await failExpiredQueuedReminders(now);
  const reminders = await findDueElderReminders(now, new Date(now.getTime() - 2 * 60 * 1000));
  await Promise.all(
    reminders.map(async (reminder) => {
      const speechText = reminderSpeechText(reminder.message, reminder.dueAt, reminder.timezone);
      await createDeviceCommand(reminder.deviceId, DeviceCommandType.speak_on_dorabot, {
        source: "elder_reminder",
        reminderId: reminder.id,
        ...(await createDeviceSpeechPayload(reminder.deviceId, speechText)),
      });
      await updateElderReminderStatus(reminder.id, {
        status: ElderReminderStatus.queued,
        attemptCount: { increment: 1 },
      });
    })
  );
}

export async function testSpeakOnDevice(userId: string) {
  const devices = await findDevicesByUser(userId);
  const device = devices[0] ?? null;
  if (!device) {
    throw new AppError("No DoraBot device found for this account", 404);
  }
  const testMessage = "Hello! I am Eldora, your voice companion. I am here whenever you need me.";
  await createDeviceCommand(device.id, DeviceCommandType.speak_on_dorabot, {
    source: "test",
    ...(await createDeviceSpeechPayload(device.id, testMessage, true)),
  });
  return { deviceId: device.id, message: testMessage };
}

export async function processDeviceVoiceAudio(audio: Buffer, deviceId: string) {
  if (!config.voiceAudioProcessorUrl) {
    throw new AppError("Voice audio processor is not configured", 501);
  }

  if (audio.length < 1000) {
    throw new AppError("Audio stream is too short", 400);
  }

  const [voiceCfg, device] = await Promise.all([
    findOrCreateDeviceVoiceConfig(deviceId),
    findDeviceById(deviceId),
  ]);
  const voiceContext = await buildVoiceContextHeader(device.elderProfileId);

  const response = await fetch(config.voiceAudioProcessorUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Voice-Enabled": String(voiceCfg.enabled),
      "X-Voice-Language": voiceCfg.language,
      "X-Voice-TTS-Voice": voiceCfg.ttsVoice,
      "X-Voice-Rate": voiceCfg.ttsRate,
      "X-Elder-Name": device.elderProfile.name,
      "X-Elder-Timezone": "Asia/Jakarta",
      ...(voiceContext ? { "X-Voice-Context": voiceContext } : {}),
    },
    body: audio,
  });

  if (!response.ok) {
    throw new AppError("Voice audio processor failed", 502);
  }

  const result = (await response.json()) as {
    message?: string;
    audio_url?: string | null;
    audioUrl?: string | null;
    text?: string;
    response_source?: string;
    responseSource?: string;
    emotion?: { state?: string; confidence?: number };
    reminder?: VoiceReminderPlan;
    latency?: {
      audio_ms?: number;
      stt_ms?: number;
      response_ms?: number;
      emotion_ms?: number;
      reminder_ms?: number;
      ai_ms?: number;
      tts_ms?: number;
      total_ms?: number;
    };
    latency_ms?: number;
  };

  const audioUrl = result.audio_url ?? result.audioUrl ?? null;
  const absoluteAudioUrl = audioUrl && audioUrl.startsWith("/") && config.voiceAudioBaseUrl
    ? `${config.voiceAudioBaseUrl}${audioUrl}`
    : audioUrl;

  const reminderPlan = result.reminder ?? { action: "none" };
  const isReminderCommand = reminderPlan.action === "create_reminder" || reminderPlan.action === "clarify_reminder";
  const intentResult = result.text && !isReminderCommand
    ? await processVoiceText({ transcript: result.text, deviceId })
    : null;

  if (
    result.message &&
    !isReminderCommand &&
    intentResult &&
    !intentResult.ignored &&
    intentResult.action !== "caregiver_notified"
  ) {
    const sceneReminder = await findConversationSceneReminder(device);
    if (sceneReminder) {
      result.message = `${result.message} ${sceneReminder.message}`;
      const speech = await createDeviceSpeechPayload(device.id, result.message);
      result.audio_url = speech.audioUrl ?? result.audio_url;
      result.audioUrl = speech.audioUrl ?? result.audioUrl;
      await createSceneReminderDelivery({
        sceneId: sceneReminder.scene.id,
        elderProfileId: device.elderProfileId,
        deviceId: device.id,
        deliveryMode: SceneReminderDeliveryMode.conversation_append,
      });
    }
  }

  const rawEmotion = result.emotion?.state ?? "neutral";
  const emotionState = Object.values(VoiceEmotionState).includes(rawEmotion as VoiceEmotionState)
    ? (rawEmotion as VoiceEmotionState)
    : VoiceEmotionState.neutral;

  const voiceLogInput = {
    deviceId,
    emotionState,
    confidence: result.emotion?.confidence ?? 0,
    transcript: result.text ?? null,
    intent: intentResult && !intentResult.ignored ? intentResult.intent : isReminderCommand ? reminderPlan.action : null,
    responseSource: result.responseSource ?? result.response_source ?? null,
    latencyMs: result.latency_ms ?? result.latency?.total_ms ?? null,
  };

  const saveTurn = async () => {
    const turn = result.text
      ? await createVoiceConversationTurn({
          elderProfileId: device.elderProfileId,
          deviceId,
          transcript: result.text,
          responseText: result.message ?? null,
          intent: voiceLogInput.intent,
          emotionState,
          confidence: voiceLogInput.confidence,
          responseSource: voiceLogInput.responseSource,
          latencyMs: voiceLogInput.latencyMs,
        })
      : null;

    if (turn) {
      await extractSimpleMemoryFact({
        elderProfileId: device.elderProfileId,
        transcript: result.text!,
        turnId: turn.id,
      });
    }

    await saveReminderFromPlan({
      plan: reminderPlan,
      device,
      homeId: device.roomCategory?.homeId ?? null,
      turnId: turn?.id ?? null,
    });
  };

  if (reminderPlan.action === "create_reminder") {
    await createVoiceEmotionLog(voiceLogInput);
    await saveTurn();
  } else {
    void createVoiceEmotionLog(voiceLogInput).catch((err) => console.warn("[Voice] Failed to save emotion log:", err));
    void saveTurn().catch((err) => console.warn("[Voice] Failed to save conversation turn:", err));
  }

  return {
    message: result.message ?? null,
    transcript: result.text ?? null,
    audioUrl: absoluteAudioUrl,
    responseSource: result.responseSource ?? result.response_source ?? null,
    emotion: { state: emotionState, confidence: result.emotion?.confidence ?? 0 },
    reminder: reminderPlan,
    latency: result.latency ?? null,
    latencyMs: result.latency_ms ?? result.latency?.total_ms ?? null,
  };
}
