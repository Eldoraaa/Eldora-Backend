import { config } from "@/config";
import { createDeviceCommand } from "@/modules/iot/iot.repository";
import { createUserNotification } from "@/modules/notifications/notifications.service";
import { findDeviceById } from "@/modules/devices/devices.repository";
import { AppError } from "@/shared/errors";
import { DeviceCommandType } from "../../../generated/prisma/client";
import type { ProcessVoiceTextInput } from "./voice.validation";

type VoiceIntent =
  | "ignored"
  | "check_in"
  | "emergency_help"
  | "fall_emergency"
  | "call_caregiver"
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

  if (text.includes("call my family") || text.includes("call my caregiver") || text.includes("call someone")) {
    return {
      intent: "call_caregiver",
      confidence: 0.95,
      ignored: false,
      responseText: "Okay. I will let your caregiver know right now.",
      notification: {
        type: "alarm",
        title: "Caregiver call requested",
        body: "The elder asked DoraBot to contact a caregiver.",
        severity: "critical",
        eventType: "voice_call_caregiver",
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
        type: "home",
        title: "Small help requested",
        body: "The elder asked for help with water or a glass.",
        severity: "normal",
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
        type: "home",
        title: "Medicine help requested",
        body: "The elder asked for help with medicine.",
        severity: "warning",
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
        message: result.responseText,
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
      message: result.responseText,
    });
  }

  if (device && result.notification) {
    const caregiverIds = device.elderProfile.userLinks.map((link) => link.userId);
    await Promise.all(
      caregiverIds.map((userId) =>
        createUserNotification({
          userId,
          type: result.notification!.type,
          title: result.notification!.title,
          body: result.notification!.body,
          homeId: device.roomCategory?.homeId ?? null,
          deviceId: device.id,
          metadata: {
            eventType: result.notification!.eventType,
            severity: result.notification!.severity,
            source: "voice",
            transcript: input.transcript,
            intent: result.intent,
            occurredAt: new Date().toISOString(),
            showCallAction: result.notification!.type === "alarm",
            followUpAt: result.notification!.type === "alarm" ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
          },
        })
      )
    );
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

export async function processDeviceVoiceAudio(audio: Buffer, deviceId: string) {
  if (!config.voiceAudioProcessorUrl) {
    throw new AppError("Voice audio processor is not configured", 501);
  }

  if (audio.length < 1000) {
    throw new AppError("Audio stream is too short", 400);
  }

  const response = await fetch(config.voiceAudioProcessorUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
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

  if (result.text) {
    await processVoiceText({ transcript: result.text, deviceId });
  }

  return {
    message: result.message ?? null,
    transcript: result.text ?? null,
    audioUrl: absoluteAudioUrl,
    responseSource: result.responseSource ?? result.response_source ?? null,
    latency: result.latency ?? null,
    latencyMs: result.latency_ms ?? result.latency?.total_ms ?? null,
  };
}
