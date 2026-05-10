import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import { prisma } from "@/config/database";
import { updateDeviceHeartbeat } from "@/services/iot.service";
import {
  commandAckSchema,
  heartbeatSchema,
} from "@/validations/iot/iot.validation";

export async function postHeartbeat(req: Request, res: Response): Promise<void> {
  const body = heartbeatSchema.parse(req.body ?? {});
  await updateDeviceHeartbeat(req.device!.id, body);
  sendSuccess(res, null, "Heartbeat received");
}

export async function getCommands(req: Request, res: Response): Promise<void> {
  const deviceId = req.device!.id;

  const commands = await prisma.deviceCommand.findMany({
    where: { deviceId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 5,
  });

  if (commands.length > 0) {
    await prisma.deviceCommand.updateMany({
      where: { id: { in: commands.map((command) => command.id) } },
      data: { status: "delivered", deliveredAt: new Date() },
    });
  }

  sendSuccess(
    res,
    commands.map((command) => ({
      id: command.id,
      commandType: command.commandType,
      payload: command.payload,
      createdAt: command.createdAt,
    })),
    "Commands fetched"
  );
}

export async function acknowledgeCommand(
  req: Request,
  res: Response
): Promise<void> {
  const body = commandAckSchema.parse(req.body);
  const commandId = req.params.id as string;
  const deviceId = req.device!.id;

  const command = await prisma.deviceCommand.findFirst({
    where: { id: commandId, deviceId },
  });

  if (!command) {
    res.status(404).json({ success: false, message: "Command not found" });
    return;
  }

  await prisma.deviceCommand.update({
    where: { id: command.id },
    data: {
      status: body.status,
      appliedAt: body.status === "applied" ? new Date() : undefined,
      payload: {
        ...(command.payload as Record<string, unknown>),
        ...(body.message ? { resultMessage: body.message } : {}),
      },
    },
  });

  sendSuccess(res, null, "Command acknowledged");
}
