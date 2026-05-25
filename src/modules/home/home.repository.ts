import { prisma } from "@/config/database";

export function findUserHomeSummary(userId: string) {
  return prisma.user.findUnique({
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
}
