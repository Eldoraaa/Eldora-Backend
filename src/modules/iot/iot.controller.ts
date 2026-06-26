import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import {
  commandAckSchema,
  deviceOfflineEventSchema,
  fallEventSchema,
  heartbeatSchema,
  liveTelemetrySchema,
} from "./iot.validation";
import {
  acknowledgeCommand as acknowledgeCommandService,
  getPendingCommands,
  reportDeviceOfflineEvent,
  reportFallEvent,
  reportLiveTelemetry,
  updateDeviceHeartbeat,
} from "./iot.service";

export async function postHeartbeat(req: Request, res: Response): Promise<void> {
  const body = heartbeatSchema.parse(req.body ?? {});
  await updateDeviceHeartbeat(req.device!.id, body);
  sendSuccess(res, null, "Heartbeat received");
}

export async function getCommands(req: Request, res: Response): Promise<void> {
  const commands = await getPendingCommands(req.device!.id);
  sendSuccess(res, commands, "Commands fetched");
}

export async function acknowledgeCommand(
  req: Request,
  res: Response
): Promise<void> {
  const body = commandAckSchema.parse(req.body);
  const commandId = req.params.id as string;
  await acknowledgeCommandService(req.device!.id, commandId, body);
  sendSuccess(res, null, "Command acknowledged");
}

export async function postFallEvent(req: Request, res: Response): Promise<void> {
  const body = fallEventSchema.parse(req.body ?? {});
  await reportFallEvent(req.device!.id, body);
  sendSuccess(res, null, "Fall alert created");
}

export async function postDeviceOfflineEvent(
  req: Request,
  res: Response
): Promise<void> {
  const body = deviceOfflineEventSchema.parse(req.body ?? {});
  await reportDeviceOfflineEvent(req.device!.id, body);
  sendSuccess(res, null, "Device offline alert created");
}

export async function postLiveTelemetry(req: Request, res: Response): Promise<void> {
  const body = liveTelemetrySchema.parse(req.body ?? {});
  await reportLiveTelemetry(req.device!.id, body);
  sendSuccess(res, null, "Live telemetry received");
}
