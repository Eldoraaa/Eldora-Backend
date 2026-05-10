import { Request, Response } from "express";
import { prisma } from "@/config/database";
import { sendSuccess } from "@/utils/response.utils";

const DEVICE_ONLINE_WINDOW_MS = 2 * 60 * 1000;

function isRecentlySeen(lastSeen: Date | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() <= DEVICE_ONLINE_WINDOW_MS;
}

export async function getSummary(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  // Get elder profiles linked to this user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      elderProfiles: {
        include: {
          devices: {
            select: {
              id: true,
              deviceId: true,
              name: true,
              isOnline: true,
              lastSeen: true,
              batteryLevel: true,
              isCharging: true,
              wifiSsid: true,
              wifiRssi: true,
              firmwareVersion: true,
            },
          },
        },
      },
    },
  });

  const devices = (user?.elderProfiles.flatMap((ep) => ep.devices) ?? []).map(
    (device) => ({
      ...device,
      isOnline: Boolean(device.isOnline && isRecentlySeen(device.lastSeen)),
    })
  );

  sendSuccess(res, {
    devices,
  });
}
