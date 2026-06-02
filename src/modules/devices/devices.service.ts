import { AppError } from "@/shared/errors";
import {
  hashLocalPairingToken,
  localPairingTokenMatches,
} from "@/shared/security";
import {
  approvePairingRequest as approvePairingRequestInRepository,
  createPairingRequest,
  createWifiCommand,
  expirePendingPairingRequests,
  findDeviceById,
  findDeviceByKey,
  findDevicesByUser,
  findPairingRequestForOwner,
  findPendingPairingRequest,
  findPendingPairingRequestsForOwner,
  findUserDevice,
  linkElderProfileUser,
  refreshPairingRequest,
  rejectPairingRequest as rejectPairingRequestInRepository,
  updateDevice,
  updateDeviceManagementState,
  updateElderProfile,
  type DeviceWithProfile,
  type PairingRequestWithDevice,
} from "./devices.repository";
import { findFirstUserHome } from "@/modules/home/home.repository";
import { findRoomCategories } from "./rooms.repository";
import { createUserNotification } from "@/modules/notifications/notifications.service";

const DEVICE_ONLINE_WINDOW_MS = 2 * 60 * 1000;
const PAIRING_REQUEST_EXPIRY_MS = 15 * 60 * 1000;
const LOCAL_PAIRING_TOKEN_TTL_MS = 10 * 60 * 1000;

type LocalPairDeviceInput = {
  deviceKey: string;
  pairingToken: string;
  elderName?: string;
  deviceName?: string;
  localIp?: string;
  batteryLevel?: number;
  isCharging?: boolean;
  wifiSsid?: string;
  wifiRssi?: number;
  firmwareVersion?: string;
};

function isRecentlySeen(lastSeen: Date | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() <= DEVICE_ONLINE_WINDOW_MS;
}

function buildDeviceResponse(device: DeviceWithProfile) {
  const elderProfile = device.elderProfile;
  const isOnline = Boolean(device.isOnline && isRecentlySeen(device.lastSeen));

  return {
    id: device.id,
    deviceId: device.deviceId,
    name: device.name ?? "Eldora Core",
    elderName: elderProfile?.name ?? "Elder profile",
    isOnline,
    lastSeen: device.lastSeen,
    batteryLevel: device.batteryLevel,
    isCharging: device.isCharging,
    wifiSsid: device.wifiSsid,
    wifiRssi: device.wifiRssi,
    localIp: device.localIp,
    firmwareVersion: device.firmwareVersion,
    sortOrder: device.sortOrder,
    isHidden: device.isHidden,
    roomCategory: device.roomCategory
      ? {
          id: device.roomCategory.id,
          name: device.roomCategory.name,
          slug: device.roomCategory.slug,
        }
      : null,
    caregiverCount: elderProfile?.userLinks?.length ?? 0,
  };
}

function buildPairingRequestResponse(request: PairingRequestWithDevice) {
  return {
    id: request.id,
    status: request.status,
    expiresAt: request.expiresAt,
    createdAt: request.createdAt,
    requester: {
      id: request.requester.id,
      name: request.requester.name,
      email: request.requester.email,
    },
    device: buildDeviceResponse(request.device),
  };
}

function buildLocalPairingDeviceData(body: LocalPairDeviceInput, now: Date) {
  return {
    isOnline: true,
    lastSeen: now,
    localPairingToken: hashLocalPairingToken(body.pairingToken),
    localPairingTokenUpdatedAt: now,
    ...(body.deviceName && { name: body.deviceName }),
    ...(body.localIp && { localIp: body.localIp }),
    ...(body.batteryLevel !== undefined && { batteryLevel: body.batteryLevel }),
    ...(body.isCharging !== undefined && { isCharging: body.isCharging }),
    ...(body.wifiSsid !== undefined && { wifiSsid: body.wifiSsid }),
    ...(body.wifiRssi !== undefined && { wifiRssi: body.wifiRssi }),
    ...(body.firmwareVersion !== undefined && {
      firmwareVersion: body.firmwareVersion,
    }),
  };
}

export async function getUserDevices(userId: string) {
  const devices = await findDevicesByUser(userId);
  return devices.map(buildDeviceResponse);
}

export async function pairDevice(
  userId: string,
  body: { deviceKey: string; elderName?: string; deviceName?: string }
) {
  const deviceKey = body.deviceKey.trim();
  const device = await findDeviceByKey(deviceKey);

  if (!device) {
    throw new AppError("Device is not registered", 404);
  }

  const alreadyLinked = device.elderProfile.userLinks.some(
    (link) => link.userId === userId
  );
  const hasOwner = device.elderProfile.userLinks.length > 0;

  if (!alreadyLinked && hasOwner) {
    throw new AppError("Device is already linked to another account", 409);
  }

  if (body.elderName) {
    await updateElderProfile(device.elderProfileId, {
      ...(body.elderName && { name: body.elderName }),
    });
  }

  if (!alreadyLinked) {
    await linkElderProfileUser(device.elderProfileId, userId);
  }

  const updatedDevice = body.deviceName
    ? await updateDevice(device.id, { name: body.deviceName })
    : await findDeviceById(device.id);

  return {
    data: buildDeviceResponse(updatedDevice),
    message: alreadyLinked ? "Device already connected" : "Device paired",
  };
}

export async function pairLocalDevice(userId: string, body: LocalPairDeviceInput) {
  const deviceKey = body.deviceKey.trim();
  const pairingToken = body.pairingToken.trim();
  const device = await findDeviceByKey(deviceKey);

  if (!device) {
    throw new AppError("Device has not checked in yet", 404);
  }

  const alreadyLinked = device.elderProfile.userLinks.some(
    (link) => link.userId === userId
  );
  const hasOwner = device.elderProfile.userLinks.length > 0;
  const hasFreshToken = Boolean(
    device.localPairingToken &&
      device.localPairingTokenUpdatedAt &&
      Date.now() - device.localPairingTokenUpdatedAt.getTime() <=
        LOCAL_PAIRING_TOKEN_TTL_MS
  );

  if (!hasFreshToken && hasOwner) {
    throw new AppError("Local pairing token is expired", 403);
  }

  if (
    hasFreshToken &&
    !localPairingTokenMatches(device.localPairingToken!, pairingToken)
  ) {
    throw new AppError("Local pairing token is not valid", 403);
  }

  if (!hasOwner) {
    const now = new Date();
    const updatedDevice = await updateDevice(device.id, {
      ...buildLocalPairingDeviceData(body, now),
      ...(body.elderName && {
        elderProfile: { update: { name: body.elderName } },
      }),
    });
    await linkElderProfileUser(device.elderProfileId, userId);

    return {
      data: buildDeviceResponse(updatedDevice),
      message: "Device paired",
      statusCode: 200,
    };
  }

  if (alreadyLinked) {
    const now = new Date();
    const updatedDevice = await updateDevice(device.id, {
      ...buildLocalPairingDeviceData(body, now),
      ...(body.elderName && {
        elderProfile: { update: { name: body.elderName } },
      }),
    });

    return {
      data: buildDeviceResponse(updatedDevice),
      message: "Device already connected",
      statusCode: 200,
    };
  }

  const expiresAt = new Date(Date.now() + PAIRING_REQUEST_EXPIRY_MS);
  let request = await findPendingPairingRequest(device.id, userId);
  let shouldNotifyOwners = false;

  if (!request) {
    request = await createPairingRequest({
      deviceId: device.id,
      requesterId: userId,
      expiresAt,
    });
    shouldNotifyOwners = true;
  } else if (request.expiresAt < new Date()) {
    request = await refreshPairingRequest(request.id, expiresAt);
    shouldNotifyOwners = true;
  }

  if (shouldNotifyOwners) {
    const ownerIds = request.device.elderProfile.userLinks
      .map((link) => link.userId)
      .filter((ownerId) => ownerId !== userId);

    await Promise.all(
      ownerIds.map(async (ownerId) => {
        const ownerHome = await findFirstUserHome(ownerId);
        await createUserNotification({
          userId: ownerId,
          type: "home",
          title: "New pairing request",
          body: `${request.requester.name} wants to connect ${request.device.name ?? "a device"}.`,
          homeId: ownerHome?.id ?? null,
          deviceId: request.device.id,
          metadata: {
            pairingRequestId: request.id,
            requesterId: request.requesterId,
          },
        });
      })
    );
  }

  return {
    data: buildPairingRequestResponse(request),
    message: "Pairing request sent",
    statusCode: 202,
  };
}

export async function getPairingRequests(userId: string) {
  await expirePendingPairingRequests(new Date());
  const requests = await findPendingPairingRequestsForOwner(userId);
  return requests.map(buildPairingRequestResponse);
}

export async function approvePairingRequest(userId: string, requestId: string) {
  const request = await findPairingRequestForOwner(userId, requestId);

  if (!request) {
    throw new AppError("Pairing request not found", 404);
  }

  if (request.status !== "pending" || request.expiresAt < new Date()) {
    throw new AppError("Pairing request is no longer active", 400);
  }

  await approvePairingRequestInRepository({
    requestId: request.id,
    elderProfileId: request.device.elderProfileId,
    requesterId: request.requesterId,
  });

  const device = await findDeviceById(request.deviceId);
  return buildDeviceResponse(device);
}

export async function rejectPairingRequest(userId: string, requestId: string) {
  const request = await findPairingRequestForOwner(userId, requestId);

  if (!request) {
    throw new AppError("Pairing request not found", 404);
  }

  await rejectPairingRequestInRepository(request.id);
}

export async function queueWifiConfig(
  userId: string,
  deviceId: string,
  body: { ssid: string; password: string }
) {
  const device = await findUserDevice(userId, deviceId);
  if (!device) {
    throw new AppError("Device not found", 404);
  }

  const command = await createWifiCommand(device.id, {
    ssid: body.ssid,
    password: body.password,
  });

  return {
    commandId: command.id,
    deviceId: device.deviceId,
    ssid: body.ssid,
  };
}

export async function updateDeviceManagement(
  userId: string,
  body: {
    devices: Array<{
      id: string;
      sortOrder?: number;
      isHidden?: boolean;
      roomCategoryId?: string | null;
    }>;
  }
) {
  const ownedDevices = await findDevicesByUser(userId);
  const ownedDeviceIds = new Set(ownedDevices.map((device) => device.id));
  const roomIdsToAssign = body.devices
    .map((device) => device.roomCategoryId)
    .filter((roomId): roomId is string => Boolean(roomId));

  if (roomIdsToAssign.length > 0) {
    const home = await findFirstUserHome(userId);
    if (!home) throw new AppError("Home not found", 404);
    const rooms = await findRoomCategories(home.id);
    const ownedRoomIds = new Set(rooms.map((room) => room.id));

    for (const roomId of roomIdsToAssign) {
      if (!ownedRoomIds.has(roomId)) {
        throw new AppError("Room not found", 404);
      }
    }
  }

  for (const device of body.devices) {
    if (!ownedDeviceIds.has(device.id)) {
      throw new AppError("Device not found", 404);
    }
  }

  const updatedDevices = await updateDeviceManagementState(body.devices);
  return updatedDevices.map(buildDeviceResponse);
}
