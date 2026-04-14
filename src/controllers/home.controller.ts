import { Request, Response } from "express";
import { prisma } from "@/config/database";
import { sendSuccess } from "@/utils/response.utils";

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
            },
          },
        },
      },
    },
  });

  const devices = user?.elderProfiles.flatMap((ep) => ep.devices) ?? [];

  // Get recipient alert IDs for this user
  const recipientAlerts = await prisma.alertRecipient.findMany({
    where: { userId },
    select: { alertId: true, deliveryStatus: true },
    orderBy: { createdAt: "desc" },
  });

  const alertIds = recipientAlerts.map((r) => r.alertId);
  const unreadCount = recipientAlerts.filter((r) => r.deliveryStatus === "pending").length;

  const recentAlerts = await prisma.alert.findMany({
    where: { id: { in: alertIds }, status: "active" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      deviceEvent: {
        select: { deviceId: true, eventType: true, timestamp: true },
      },
    },
  });

  sendSuccess(res, {
    devices,
    recentAlerts,
    unreadAlertCount: unreadCount,
  });
}
