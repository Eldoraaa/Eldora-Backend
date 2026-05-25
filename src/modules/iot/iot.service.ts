import { AppError } from "@/shared/errors";
import { hashLocalPairingToken } from "@/shared/security";
import { DeviceTelemetry } from "@/types/iot.types";
import {
  findCommandForDevice,
  findPendingCommands,
  markCommandsDelivered,
  updateCommand,
  updateDevice,
} from "./iot.repository";

export async function updateDeviceHeartbeat(
  deviceId: string,
  telemetry: DeviceTelemetry
): Promise<void> {
  await updateDevice(deviceId, {
    isOnline: true,
    lastSeen: new Date(),
    ...(telemetry.batteryLevel !== undefined && {
      batteryLevel: telemetry.batteryLevel,
    }),
    ...(telemetry.isCharging !== undefined && {
      isCharging: telemetry.isCharging,
    }),
    ...(telemetry.wifiSsid !== undefined && { wifiSsid: telemetry.wifiSsid }),
    ...(telemetry.wifiRssi !== undefined && { wifiRssi: telemetry.wifiRssi }),
    ...(telemetry.localIp !== undefined && { localIp: telemetry.localIp }),
    ...(telemetry.localPairingToken !== undefined && {
      localPairingToken: hashLocalPairingToken(telemetry.localPairingToken),
      localPairingTokenUpdatedAt: new Date(),
    }),
    ...(telemetry.firmwareVersion !== undefined && {
      firmwareVersion: telemetry.firmwareVersion,
    }),
  });
}

export async function getPendingCommands(deviceId: string) {
  const commands = await findPendingCommands(deviceId);

  if (commands.length > 0) {
    await markCommandsDelivered(commands.map((command) => command.id));
  }

  return commands.map((command) => ({
    id: command.id,
    commandType: command.commandType,
    payload: command.payload,
    createdAt: command.createdAt,
  }));
}

export async function acknowledgeCommand(
  deviceId: string,
  commandId: string,
  body: { status: "applied" | "failed"; message?: string }
): Promise<void> {
  const command = await findCommandForDevice(commandId, deviceId);

  if (!command) {
    throw new AppError("Command not found", 404);
  }

  const currentPayload =
    typeof command.payload === "object" &&
    command.payload !== null &&
    !Array.isArray(command.payload)
      ? command.payload
      : {};

  await updateCommand(command.id, {
    status: body.status,
    appliedAt: body.status === "applied" ? new Date() : undefined,
    payload: {
      ...currentPayload,
      ...(body.message ? { resultMessage: body.message } : {}),
    },
  });
}
