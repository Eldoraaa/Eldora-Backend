import { prisma } from "@/config/database";
import type { Prisma } from "../../../generated/prisma/client";

export function updateDevice(deviceId: string, data: Prisma.DeviceUpdateInput) {
  return prisma.device.update({
    where: { id: deviceId },
    data,
  });
}

export function findPendingCommands(deviceId: string) {
  return prisma.deviceCommand.findMany({
    where: { deviceId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
}

export function markCommandsDelivered(commandIds: string[]) {
  return prisma.deviceCommand.updateMany({
    where: { id: { in: commandIds } },
    data: { status: "delivered", deliveredAt: new Date() },
  });
}

export function findCommandForDevice(commandId: string, deviceId: string) {
  return prisma.deviceCommand.findFirst({
    where: { id: commandId, deviceId },
  });
}

export function updateCommand(
  commandId: string,
  data: Prisma.DeviceCommandUpdateInput
) {
  return prisma.deviceCommand.update({
    where: { id: commandId },
    data,
  });
}
