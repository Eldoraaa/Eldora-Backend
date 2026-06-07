import { prisma } from "@/config/database";
import type { Prisma } from "../../../generated/prisma/client";

const deviceInclude = {
  elderProfile: {
    include: { userLinks: { select: { userId: true } } },
  },
  roomCategory: true,
} satisfies Prisma.MsDeviceInclude;

const pairingRequestInclude = {
  requester: { select: { id: true, name: true, email: true } },
  device: { include: deviceInclude },
} satisfies Prisma.TrDevicePairingRequestInclude;

export type DeviceWithProfile = Prisma.MsDeviceGetPayload<{
  include: typeof deviceInclude;
}>;

export type PairingRequestWithDevice = Prisma.TrDevicePairingRequestGetPayload<{
  include: typeof pairingRequestInclude;
}>;

export function findDevicesByUser(userId: string) {
  return prisma.msDevice.findMany({
    where: { elderProfile: { userLinks: { some: { userId } } } },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    include: deviceInclude,
  });
}

export function findDeviceByKey(deviceKey: string) {
  return prisma.msDevice.findUnique({
    where: { deviceKey },
    include: deviceInclude,
  });
}

export function findDeviceByKeyForAuth(deviceKey: string) {
  return prisma.msDevice.findUnique({ where: { deviceKey } });
}

export function createUnclaimedDevice(deviceKey: string) {
  return prisma.msDevice.create({
    data: {
      deviceId: deviceKey,
      deviceKey,
      name: "DoraBot",
      elderProfile: {
        create: {
          name: "Eldora User",
        },
      },
    },
  });
}

export function findUserDevice(userId: string, deviceId: string) {
  return prisma.msDevice.findFirst({
    where: {
      id: deviceId,
      elderProfile: { userLinks: { some: { userId } } },
    },
    include: deviceInclude,
  });
}

export function findDeviceById(deviceId: string) {
  return prisma.msDevice.findUniqueOrThrow({
    where: { id: deviceId },
    include: deviceInclude,
  });
}

export function updateElderProfile(
  elderProfileId: string,
  data: Prisma.MsElderProfileUpdateInput
) {
  return prisma.msElderProfile.update({
    where: { id: elderProfileId },
    data,
  });
}

export function updateDevice(
  deviceId: string,
  data: Prisma.MsDeviceUpdateInput
) {
  return prisma.msDevice.update({
    where: { id: deviceId },
    data,
    include: deviceInclude,
  });
}

export function linkElderProfileUser(elderProfileId: string, userId: string) {
  return prisma.trElderProfileUser.upsert({
    where: { elderProfileId_userId: { elderProfileId, userId } },
    update: {},
    create: { elderProfileId, userId },
  });
}

export function expirePendingPairingRequests(now: Date) {
  return prisma.trDevicePairingRequest.updateMany({
    where: { status: "pending", expiresAt: { lt: now } },
    data: { status: "expired" },
  });
}

export function findPendingPairingRequestsForOwner(userId: string) {
  return prisma.trDevicePairingRequest.findMany({
    where: {
      status: "pending",
      device: { elderProfile: { userLinks: { some: { userId } } } },
    },
    orderBy: { createdAt: "desc" },
    include: pairingRequestInclude,
  });
}

export function findPairingRequestForOwner(userId: string, requestId: string) {
  return prisma.trDevicePairingRequest.findFirst({
    where: {
      id: requestId,
      device: { elderProfile: { userLinks: { some: { userId } } } },
    },
    include: pairingRequestInclude,
  });
}

export function findPendingPairingRequest(deviceId: string, requesterId: string) {
  return prisma.trDevicePairingRequest.findFirst({
    where: { deviceId, requesterId, status: "pending" },
    include: pairingRequestInclude,
  });
}

export function createPairingRequest(data: {
  deviceId: string;
  requesterId: string;
  expiresAt: Date;
}) {
  return prisma.trDevicePairingRequest.create({
    data,
    include: pairingRequestInclude,
  });
}

export function refreshPairingRequest(requestId: string, expiresAt: Date) {
  return prisma.trDevicePairingRequest.update({
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
    prisma.trElderProfileUser.upsert({
      where: {
        elderProfileId_userId: {
          elderProfileId: data.elderProfileId,
          userId: data.requesterId,
        },
      },
      update: {},
      create: {
        elderProfileId: data.elderProfileId,
        userId: data.requesterId,
      },
    }),
    prisma.trDevicePairingRequest.update({
      where: { id: data.requestId },
      data: { status: "approved", decidedAt: new Date() },
    }),
  ]);
}

export function rejectPairingRequest(requestId: string) {
  return prisma.trDevicePairingRequest.update({
    where: { id: requestId },
    data: { status: "rejected", decidedAt: new Date() },
  });
}

export function createWifiCommand(deviceId: string, payload: { ssid: string; password: string }) {
  return prisma.trDeviceCommand.create({
    data: {
      deviceId,
      commandType: "configure_wifi",
      payload,
    },
  });
}

export function updateDeviceManagementState(
  updates: Array<{
    id: string;
    sortOrder?: number;
    isHidden?: boolean;
    roomCategoryId?: string | null;
  }>
) {
  return prisma.$transaction(
    updates.map((update) =>
      prisma.msDevice.update({
        where: { id: update.id },
        data: {
          ...(update.sortOrder !== undefined && {
            sortOrder: update.sortOrder,
          }),
          ...(update.isHidden !== undefined && {
            isHidden: update.isHidden,
          }),
          ...(update.roomCategoryId !== undefined && {
            roomCategoryId: update.roomCategoryId,
          }),
        },
        include: deviceInclude,
      })
    )
  );
}
