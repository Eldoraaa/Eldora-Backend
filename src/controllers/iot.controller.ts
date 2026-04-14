import { Request, Response } from "express";
import { z } from "zod";
import { sendSuccess } from "@/utils/response.utils";
import { processEvent, processHeartbeat } from "@/services/iot.service";

const eventSchema = z.object({
  eventType: z.enum([
    "emergency",
    "assistance_request",
    "service_request",
    "sensor_anomaly",
    "device_status",
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function postEvent(req: Request, res: Response): Promise<void> {
  const body = eventSchema.parse(req.body);
  const device = req.device!;

  const result = await processEvent(
    device.id,
    device.elderProfileId,
    body.eventType,
    body.payload as Record<string, unknown>
  );

  sendSuccess(res, result, "Event diterima", 201);
}

export async function postHeartbeat(req: Request, res: Response): Promise<void> {
  await processHeartbeat(req.device!.id);
  sendSuccess(res, null, "Heartbeat diterima");
}
