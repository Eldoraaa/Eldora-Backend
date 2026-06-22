import { config } from "@/config";
import { createDeviceCommand } from "@/modules/iot/iot.repository";
import { createHomeNotification, createUserNotification } from "@/modules/notifications/notifications.service";
import { findDeviceById, findDevicesByUser } from "@/modules/devices/devices.repository";
import { findOrCreateDeviceVoiceConfig } from "@/modules/devices/voice-config.repository";
import { AppError } from "@/shared/errors";
import { DeviceCommandType, VoiceEmotionState } from "../../../generated/prisma/client";
import { createVoiceEmotionLog } from "./voice.repository";
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

  const voiceCfg = await findOrCreateDeviceVoiceConfig(deviceId);

  const response = await fetch(config.voiceAudioProcessorUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Voice-Enabled": String(voiceCfg.enabled),
      "X-Voice-Language": voiceCfg.language,
      "X-Voice-TTS-Voice": voiceCfg.ttsVoice,
      "X-Voice-Rate": voiceCfg.ttsRate,
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
    latency?: {
      audio_ms?: number;
      stt_ms?: number;
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

  // Layer 2 (intent) + Layer 3 (emotion save) run in parallel
  const intentResult = result.text
    ? await processVoiceText({ transcript: result.text, deviceId })
    : null;

  const rawEmotion = result.emotion?.state ?? "neutral";
  const emotionState = Object.values(VoiceEmotionState).includes(rawEmotion as VoiceEmotionState)
    ? (rawEmotion as VoiceEmotionState)
    : VoiceEmotionState.neutral;

  void createVoiceEmotionLog({
    deviceId,
    emotionState,
    confidence: result.emotion?.confidence ?? 0,
    transcript: result.text ?? null,
    intent: intentResult && !intentResult.ignored ? intentResult.intent : null,
    responseSource: result.responseSource ?? result.response_source ?? null,
    latencyMs: result.latency_ms ?? result.latency?.total_ms ?? null,
  }).catch((err) => console.warn("[Voice] Failed to save emotion log:", err));

  return {
    message: result.message ?? null,
    transcript: result.text ?? null,
    audioUrl: absoluteAudioUrl,
    responseSource: result.responseSource ?? result.response_source ?? null,
    emotion: { state: emotionState, confidence: result.emotion?.confidence ?? 0 },
    latency: result.latency ?? null,
    latencyMs: result.latency_ms ?? result.latency?.total_ms ?? null,
  };
}
