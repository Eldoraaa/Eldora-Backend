import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@/config/database";
import { sendSuccess, sendError } from "@/utils/response.utils";

const listQuerySchema = z.object({
  status: z.enum(["active", "acknowledged", "resolved"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function getAlerts(req: Request, res: Response): Promise<void> {
  const query = listQuerySchema.parse(req.query);
  const userId = req.user!.id;

  // Get alert IDs this user is a recipient of
  const recipientAlerts = await prisma.alertRecipient.findMany({
    where: { userId },
    select: { alertId: true },
  });
  const alertIds = recipientAlerts.map((r) => r.alertId);

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where: {
        id: { in: alertIds },
        ...(query.status && { status: query.status }),
        ...(query.priority && { priority: query.priority }),
      },
      orderBy: { createdAt: "desc" },
      skip: query.offset,
      take: query.limit,
      include: {
        deviceEvent: {
          select: { deviceId: true, eventType: true, timestamp: true },
        },
      },
    }),
    prisma.alert.count({
      where: {
        id: { in: alertIds },
        ...(query.status && { status: query.status }),
        ...(query.priority && { priority: query.priority }),
      },
    }),
  ]);

  sendSuccess(res, { alerts, total, limit: query.limit, offset: query.offset });
}

export async function getAlertById(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const alertId = req.params.id as string;

  const recipient = await prisma.alertRecipient.findUnique({
    where: { alertId_userId: { alertId, userId } },
  });

  if (!recipient) {
    sendError(res, "Alert tidak ditemukan", 404);
    return;
  }

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: {
      deviceEvent: true,
    },
  });

  if (!alert) {
    sendError(res, "Alert tidak ditemukan", 404);
    return;
  }

  sendSuccess(res, alert);
}

export async function acknowledgeAlert(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const alertId = req.params.id as string;

  const recipient = await prisma.alertRecipient.findUnique({
    where: { alertId_userId: { alertId, userId } },
  });

  if (!recipient) {
    sendError(res, "Alert tidak ditemukan", 404);
    return;
  }

  await prisma.alert.update({
    where: { id: alertId },
    data: { status: "acknowledged" },
  });

  sendSuccess(res, null, "Alert berhasil di-acknowledge");
}
