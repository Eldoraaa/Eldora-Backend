import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import { processEvent, processHeartbeat } from "@/services/iot.service";
import { eventSchema } from "@/validations/iot/iot.validation";

export async function postEvent(req: Request, res: Response): Promise<void> {
  const body = eventSchema.parse(req.body);
  const device = req.device!;

  const result = await processEvent(
    device.id,
    device.elderProfileId,
    body.eventType,
    body.payload as Record<string, unknown>
  );

  sendSuccess(res, result, "Event received", 201);
}

export async function postHeartbeat(req: Request, res: Response): Promise<void> {
  await processHeartbeat(req.device!.id);
  sendSuccess(res, null, "Heartbeat received");
}
