import { prisma } from "@/config/database";
import type { DeviceCommandType, Prisma } from "../../../generated/prisma/client";

export function findStaleOnlineDevices(cutoff: Date) {
  return prisma.msDevice.findMany({
    where: {
      isOnline: true,
      OR: [{ lastSeen: null }, { lastSeen: { lt: cutoff } }],
    },
    take: 50,
  });
}

export function updateDevice(deviceId: string, data: Prisma.MsDeviceUpdateInput) {
  return prisma.msDevice.update({
    where: { id: deviceId },
    data,
  });
}

export function createDeviceCommand(
  deviceId: string,
  commandType: DeviceCommandType,
  payload: Prisma.InputJsonValue
) {
  return prisma.trDeviceCommand.create({
    data: {
      deviceId,
      commandType,
      payload,
    },
  });
}

export function findPendingCommands(deviceId: string) {
  return prisma.trDeviceCommand.findMany({
    where: { deviceId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
}

export function markCommandsDelivered(commandIds: string[]) {
  return prisma.trDeviceCommand.updateMany({
    where: { id: { in: commandIds } },
    data: { status: "delivered", deliveredAt: new Date() },
  });
}

export function findCommandForDevice(commandId: string, deviceId: string) {
  return prisma.trDeviceCommand.findFirst({
    where: { id: commandId, deviceId },
  });
}

export function updateCommand(
  commandId: string,
  data: Prisma.TrDeviceCommandUpdateInput
) {
  return prisma.trDeviceCommand.update({
    where: { id: commandId },
    data,
  });
}
