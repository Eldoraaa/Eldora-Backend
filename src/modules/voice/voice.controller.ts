import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import { processVoiceText } from "./voice.service";
import { processVoiceTextSchema } from "./voice.validation";

export async function processVoiceTextController(
  req: Request,
  res: Response
): Promise<void> {
  const body = processVoiceTextSchema.parse(req.body);
  const result = await processVoiceText(body);
  sendSuccess(res, result, result.ignored ? "Voice ignored" : "Voice processed");
}

export async function processDeviceVoiceTextController(
  req: Request,
  res: Response
): Promise<void> {
  const body = processVoiceTextSchema.omit({ deviceId: true }).parse(req.body);
  const result = await processVoiceText({ ...body, deviceId: req.device!.id });
  sendSuccess(res, result, result.ignored ? "Voice ignored" : "Voice processed");
}
