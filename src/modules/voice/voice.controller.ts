import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import { processDeviceVoiceAudio } from "./voice.service";

export async function processDeviceVoiceAudioController(
  req: Request,
  res: Response
): Promise<void> {
  const audio = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  const result = await processDeviceVoiceAudio(audio, req.device!.id);
  sendSuccess(res, result, "Voice audio processed");
}
