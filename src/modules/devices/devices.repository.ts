import { prisma } from "@/config/database";
import type { Prisma } from "../../../generated/prisma/client";

const deviceInclude = {
  elderProfile: {
    include: { users: { select: { id: true } } },
  },
} satisfies Prisma.DeviceInclude;

const pairingRequestInclude = {
  requester: { select: { id: true, name: true, email: true } },
  device: { include: deviceInclude },
} satisfies Prisma.DevicePairingRequestInclude;

export type DeviceWithProfile = Prisma.DeviceGetPayload<{
  include: typeof deviceInclude;
}>;

export type PairingRequestWithDevice = Prisma.DevicePairingRequestGetPayload<{
  include: typeof pairingRequestInclude;
}>;

export function findDevicesByUser(userId: string) {
  return prisma.device.findMany({
    where: { elderProfile: { users: { some: { id: userId } } } },
    orderBy: { updatedAt: "desc" },
    include: deviceInclude,
  });
}

export function findDeviceByKey(deviceKey: string) {
  return prisma.device.findUnique({
    where: { deviceKey },
    include: deviceInclude,
  });
}

export function findDeviceByKeyForAuth(deviceKey: string) {
  return prisma.device.findUnique({ where: { deviceKey } });
}

export function createUnclaimedDevice(deviceKey: string) {
  return prisma.device.create({
    data: {
      deviceId: deviceKey,
      deviceKey,
      name: "Eldora Hub",
      elderProfile: {
        create: {
          name: "Eldora User",
        },
      },
    },
  });
}

export function findUserDevice(userId: string, deviceId: string) {
  return prisma.device.findFirst({
    where: {
      id: deviceId,
      elderProfile: { users: { some: { id: userId } } },
    },
    include: deviceInclude,
  });
}

export function findDeviceById(deviceId: string) {
  return prisma.device.findUniqueOrThrow({
    where: { id: deviceId },
    include: deviceInclude,
  });
}

export function updateElderProfile(
  elderProfileId: string,
  data: Prisma.ElderProfileUpdateInput
) {
  return prisma.elderProfile.update({
    where: { id: elderProfileId },
    data,
  });
}

export function updateDevice(
  deviceId: string,
  data: Prisma.DeviceUpdateInput
) {
  return prisma.device.update({
    where: { id: deviceId },
    data,
    include: deviceInclude,
  });
}

export function expirePendingPairingRequests(now: Date) {
  return prisma.devicePairingRequest.updateMany({
    where: { status: "pending", expiresAt: { lt: now } },
    data: { status: "expired" },
  });
}

export function findPendingPairingRequestsForOwner(userId: string) {
  return prisma.devicePairingRequest.findMany({
    where: {
      status: "pending",
      device: { elderProfile: { users: { some: { id: userId } } } },
    },
    orderBy: { createdAt: "desc" },
    include: pairingRequestInclude,
  });
}

export function findPairingRequestForOwner(userId: string, requestId: string) {
  return prisma.devicePairingRequest.findFirst({
    where: {
      id: requestId,
      device: { elderProfile: { users: { some: { id: userId } } } },
    },
    include: pairingRequestInclude,
  });
}

export function findPendingPairingRequest(deviceId: string, requesterId: string) {
  return prisma.devicePairingRequest.findFirst({
    where: { deviceId, requesterId, status: "pending" },
    include: pairingRequestInclude,
  });
}

export function createPairingRequest(data: {
  deviceId: string;
  requesterId: string;
  expiresAt: Date;
}) {
  return prisma.devicePairingRequest.create({
    data,
    include: pairingRequestInclude,
  });
}

export function refreshPairingRequest(requestId: string, expiresAt: Date) {
  return prisma.devicePairingRequest.update({
    where: { id: requestId },
    data: { expiresAt },
    include: pairingRequestInclude,
  });
}

export function approvePairingRequest(data: {
  requestId: string;
  elderProfileId: string;
  requesterId: string;
}) {
  return prisma.$transaction([
    prisma.elderProfile.update({
      where: { id: data.elderProfileId },
      data: { users: { connect: { id: data.requesterId } } },
    }),
    prisma.devicePairingRequest.update({
      where: { id: data.requestId },
      data: { status: "approved", decidedAt: new Date() },
    }),
  ]);
}

export function rejectPairingRequest(requestId: string) {
  return prisma.devicePairingRequest.update({
    where: { id: requestId },
    data: { status: "rejected", decidedAt: new Date() },
  });
}

export function createWifiCommand(deviceId: string, payload: { ssid: string; password: string }) {
  return prisma.deviceCommand.create({
    data: {
      deviceId,
      commandType: "configure_wifi",
      payload,
    },
  });
}
