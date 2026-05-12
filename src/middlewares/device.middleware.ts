import { Request, Response, NextFunction } from "express";
import { prisma } from "@/config/database";
import { sendError } from "@/utils/response.utils";

export async function authenticateDevice(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const headerValue = req.headers["x-device-key"];
  const deviceKey = Array.isArray(headerValue)
    ? headerValue[0]?.trim()
    : headerValue?.trim();
  if (!deviceKey) {
    sendError(res, "Device key tidak ditemukan", 401);
    return;
  }
  const device = await prisma.device.findUnique({ where: { deviceKey } });
  if (!device) {
    sendError(res, "Device key tidak valid", 401);
    return;
  }
  req.device = {
    id: device.id,
    deviceId: device.deviceId,
    elderProfileId: device.elderProfileId,
  };
  next();
}
