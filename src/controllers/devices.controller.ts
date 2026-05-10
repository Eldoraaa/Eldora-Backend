import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { prisma } from "@/config/database";
import { sendError, sendSuccess } from "@/utils/response.utils";
import {
  localPairDeviceSchema,
  pairDeviceSchema,
  wifiCommandSchema,
} from "@/validations/devices/devices.validation";

const DEVICE_ONLINE_WINDOW_MS = 2 * 60 * 1000;
const PAIRING_REQUEST_EXPIRY_MS = 15 * 60 * 1000;

function isRecentlySeen(lastSeen: Date | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() <= DEVICE_ONLINE_WINDOW_MS;
}

function buildDeviceResponse(device: any) {
  const elderProfile = device.elderProfile;
  const isOnline = Boolean(device.isOnline && isRecentlySeen(device.lastSeen));
  return {
    id: device.id,
    deviceId: device.deviceId,
    deviceKey: device.deviceKey,
    name: device.name ?? "Eldora Hub",
    elderName: elderProfile?.name ?? "Elder profile",
    isOnline,
    lastSeen: device.lastSeen,
    batteryLevel: device.batteryLevel,
    isCharging: device.isCharging,
    wifiSsid: device.wifiSsid,
    wifiRssi: device.wifiRssi,
    localIp: device.localIp,
    firmwareVersion: device.firmwareVersion,
    caregiverCount: elderProfile?.users?.length ?? 0,
  };
}

function buildPairingRequestResponse(request: any) {
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

async function findUserDevice(userId: string, deviceId: string) {
  return prisma.device.findFirst({
    where: {
      id: deviceId,
      elderProfile: { users: { some: { id: userId } } },
    },
    include: {
      elderProfile: {
        include: { users: { select: { id: true } } },
      },
    },
  });
}

export async function getDevices(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  const devices = await prisma.device.findMany({
    where: { elderProfile: { users: { some: { id: userId } } } },
    orderBy: { updatedAt: "desc" },
    include: {
      elderProfile: {
        include: { users: { select: { id: true } } },
      },
    },
  });

  sendSuccess(res, devices.map(buildDeviceResponse));
}

export async function pairDevice(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const body = pairDeviceSchema.parse(req.body);
  const deviceKey = body.deviceKey.trim();

  let device = await prisma.device.findUnique({
    where: { deviceKey },
    include: {
      elderProfile: {
        include: { users: { select: { id: true } } },
      },
    },
  });

  if (!device) {
    const deviceSerial = `ELD-${randomUUID().slice(0, 8).toUpperCase()}`;
    device = await prisma.device.create({
      data: {
        deviceId: deviceSerial,
        deviceKey,
        name: body.deviceName ?? "Eldora Hub",
        elderProfile: {
          create: {
            name: body.elderName ?? "Eldora User",
            users: { connect: { id: userId } },
          },
        },
      },
      include: {
        elderProfile: {
          include: { users: { select: { id: true } } },
        },
      },
    });

    sendSuccess(res, buildDeviceResponse(device), "Device paired", 201);
    return;
  }

  const alreadyLinked = device.elderProfile.users.some((user) => user.id === userId);

  if (!alreadyLinked || body.elderName) {
    await prisma.elderProfile.update({
      where: { id: device.elderProfileId },
      data: {
        ...(body.elderName && { name: body.elderName }),
        ...(!alreadyLinked && { users: { connect: { id: userId } } }),
      },
    });
  }

  if (body.deviceName) {
    await prisma.device.update({
      where: { id: device.id },
      data: { name: body.deviceName },
    });
  }

  const updatedDevice = await prisma.device.findUniqueOrThrow({
    where: { id: device.id },
    include: {
      elderProfile: {
        include: { users: { select: { id: true } } },
      },
    },
  });

  sendSuccess(
    res,
    buildDeviceResponse(updatedDevice),
    alreadyLinked ? "Device already connected" : "Device paired"
  );
}

export async function pairLocalDevice(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.id;
  const body = localPairDeviceSchema.parse(req.body);
  const deviceKey = body.deviceKey.trim();
  const pairingToken = body.pairingToken.trim();

  let device = await prisma.device.findUnique({
    where: { deviceKey },
    include: {
      elderProfile: {
        include: { users: { select: { id: true } } },
      },
    },
  });

  if (!device) {
    const deviceSerial = `ELD-${randomUUID().slice(0, 8).toUpperCase()}`;
    device = await prisma.device.create({
      data: {
        deviceId: deviceSerial,
        deviceKey,
        name: body.deviceName ?? "Eldora Hub",
        localIp: body.localIp,
        localPairingToken: pairingToken,
        localPairingTokenUpdatedAt: new Date(),
        elderProfile: {
          create: {
            name: body.elderName ?? "Eldora User",
            users: { connect: { id: userId } },
          },
        },
      },
      include: {
        elderProfile: {
          include: { users: { select: { id: true } } },
        },
      },
    });

    sendSuccess(res, buildDeviceResponse(device), "Local hub paired", 201);
    return;
  }

  if (device.localPairingToken && device.localPairingToken !== pairingToken) {
    sendError(res, "Local pairing token is not valid", 403);
    return;
  }

  const alreadyLinked = device.elderProfile.users.some((user) => user.id === userId);

  if (alreadyLinked) {
    const updatedDevice = await prisma.device.update({
      where: { id: device.id },
      data: {
        ...(body.localIp && { localIp: body.localIp }),
        localPairingToken: pairingToken,
        localPairingTokenUpdatedAt: new Date(),
        ...(body.deviceName && { name: body.deviceName }),
      },
      include: {
        elderProfile: {
          include: { users: { select: { id: true } } },
        },
      },
    });

    if (body.elderName) {
      await prisma.elderProfile.update({
        where: { id: updatedDevice.elderProfileId },
        data: { name: body.elderName },
      });
    }

    sendSuccess(res, buildDeviceResponse(updatedDevice), "Device already connected");
    return;
  }

  const expiresAt = new Date(Date.now() + PAIRING_REQUEST_EXPIRY_MS);
  let request = await prisma.devicePairingRequest.findFirst({
    where: {
      deviceId: device.id,
      requesterId: userId,
      status: "pending",
    },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      device: {
        include: {
          elderProfile: {
            include: { users: { select: { id: true } } },
          },
        },
      },
    },
  });

  if (!request) {
    request = await prisma.devicePairingRequest.create({
      data: {
        deviceId: device.id,
        requesterId: userId,
        expiresAt,
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        device: {
          include: {
            elderProfile: {
              include: { users: { select: { id: true } } },
            },
          },
        },
      },
    });
  } else if (request.expiresAt < new Date()) {
    request = await prisma.devicePairingRequest.update({
      where: { id: request.id },
      data: { expiresAt },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        device: {
          include: {
            elderProfile: {
              include: { users: { select: { id: true } } },
            },
          },
        },
      },
    });
  }

  sendSuccess(
    res,
    buildPairingRequestResponse(request),
    "Pairing request sent",
    202
  );
}

export async function getPairingRequests(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.id;

  await prisma.devicePairingRequest.updateMany({
    where: { status: "pending", expiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });

  const requests = await prisma.devicePairingRequest.findMany({
    where: {
      status: "pending",
      device: { elderProfile: { users: { some: { id: userId } } } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      device: {
        include: {
          elderProfile: {
            include: { users: { select: { id: true } } },
          },
        },
      },
    },
  });

  sendSuccess(res, requests.map(buildPairingRequestResponse));
}

export async function approvePairingRequest(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.id;
  const requestId = req.params.id as string;

  const request = await prisma.devicePairingRequest.findFirst({
    where: {
      id: requestId,
      device: { elderProfile: { users: { some: { id: userId } } } },
    },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      device: {
        include: {
          elderProfile: {
            include: { users: { select: { id: true } } },
          },
        },
      },
    },
  });

  if (!request) {
    sendError(res, "Pairing request not found", 404);
    return;
  }

  if (request.status !== "pending" || request.expiresAt < new Date()) {
    sendError(res, "Pairing request is no longer active", 400);
    return;
  }

  await prisma.$transaction([
    prisma.elderProfile.update({
      where: { id: request.device.elderProfileId },
      data: { users: { connect: { id: request.requesterId } } },
    }),
    prisma.devicePairingRequest.update({
      where: { id: request.id },
      data: { status: "approved", decidedAt: new Date() },
    }),
  ]);

  const device = await prisma.device.findUniqueOrThrow({
    where: { id: request.deviceId },
    include: {
      elderProfile: {
        include: { users: { select: { id: true } } },
      },
    },
  });

  sendSuccess(res, buildDeviceResponse(device), "Pairing request approved");
}

export async function rejectPairingRequest(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.id;
  const requestId = req.params.id as string;

  const request = await prisma.devicePairingRequest.findFirst({
    where: {
      id: requestId,
      device: { elderProfile: { users: { some: { id: userId } } } },
    },
  });

  if (!request) {
    sendError(res, "Pairing request not found", 404);
    return;
  }

  await prisma.devicePairingRequest.update({
    where: { id: request.id },
    data: { status: "rejected", decidedAt: new Date() },
  });

  sendSuccess(res, null, "Pairing request rejected");
}

export async function queueWifiConfig(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.id;
  const deviceId = req.params.id as string;
  const body = wifiCommandSchema.parse(req.body);

  const device = await findUserDevice(userId, deviceId);
  if (!device) {
    sendError(res, "Device not found", 404);
    return;
  }

  const command = await prisma.deviceCommand.create({
    data: {
      deviceId: device.id,
      commandType: "configure_wifi",
      payload: {
        ssid: body.ssid,
        password: body.password,
      },
    },
  });

  sendSuccess(
    res,
    {
      commandId: command.id,
      deviceId: device.deviceId,
      ssid: body.ssid,
    },
    "WiFi setup queued"
  );
}
