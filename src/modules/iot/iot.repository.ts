import { prisma } from "@/config/database";
import type { Prisma } from "../../../generated/prisma/client";

export function updateDevice(deviceId: string, data: Prisma.MsDeviceUpdateInput) {
  return prisma.msDevice.update({
    where: { id: deviceId },
    data,
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
