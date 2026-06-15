import type { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import { AppError } from "@/shared/errors";
import { config } from "@/config";
import { findDevicesByUser } from "./devices.repository";
import {
  findOrCreateDeviceVoiceConfig,
  updateDeviceVoiceConfig,
  type VoiceConfigInput,
} from "./voice-config.repository";

async function assertUserOwnsDevice(userId: string, deviceId: string) {
  const devices = await findDevicesByUser(userId);
  if (!devices.some((d) => d.id === deviceId)) {
    throw new AppError("Device not found", 404);
  }
}

export async function getDeviceVoiceConfig(req: Request, res: Response) {
  const id = String(req.params.id);
  await assertUserOwnsDevice(req.user!.id, id);
  const cfg = await findOrCreateDeviceVoiceConfig(id);
  sendSuccess(res, cfg, "Voice config retrieved");
}

export async function updateDeviceVoiceConfigController(req: Request, res: Response) {
  const id = String(req.params.id);
  await assertUserOwnsDevice(req.user!.id, id);
  const { enabled, language, ttsVoice, ttsRate } = req.body as VoiceConfigInput;
  const cfg = await updateDeviceVoiceConfig(id, { enabled, language, ttsVoice, ttsRate });
  sendSuccess(res, cfg, "Voice config updated");
}

export async function testDeviceVoiceAudio(req: Request, res: Response) {
  const id = String(req.params.id);
  await assertUserOwnsDevice(req.user!.id, id);

  if (!config.voiceAudioBaseUrl) {
    throw new AppError("Voice service is not configured", 501);
  }

  const cfg = await findOrCreateDeviceVoiceConfig(id);
  const testText = "Hello, I am Eldora, your voice companion. I am here whenever you need me.";

  const response = await fetch(`${config.voiceAudioBaseUrl}/api/test-tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Voice-Language": cfg.language,
      "X-Voice-TTS-Voice": cfg.ttsVoice,
      "X-Voice-Rate": cfg.ttsRate,
    },
    body: JSON.stringify({ text: testText }),
  });

  if (!response.ok) throw new AppError("Voice test failed", 502);

  const result = (await response.json()) as { audio_url?: string; audioUrl?: string };
  const relativeUrl = result.audio_url ?? result.audioUrl ?? null;
  const absoluteUrl =
    relativeUrl && relativeUrl.startsWith("/")
      ? `${config.voiceAudioBaseUrl}${relativeUrl}`
      : relativeUrl;

  sendSuccess(res, { audioUrl: absoluteUrl, text: testText }, "Voice test ready");
}
