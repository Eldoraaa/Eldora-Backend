import { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { config } from "@/config";
import { sendError } from "@/utils/response.utils";
import type { Device } from "../../generated/prisma/client";
import {
  createUnclaimedDevice as createUnclaimedDeviceRecord,
  findDeviceByKeyForAuth,
} from "@/modules/devices/devices.repository";

function getHeaderValue(req: Request, header: string): string | null {
  const headerValue = req.headers[header];
  const value = Array.isArray(headerValue)
    ? headerValue[0]?.trim()
    : headerValue?.trim();

  return value || null;
}

function getDeviceKey(req: Request): string | null {
  return getHeaderValue(req, "x-device-key");
}

function secretsMatch(expected: string, actual: string): boolean {
  const expectedHash = createHash("sha256").update(expected).digest();
  const actualHash = createHash("sha256").update(actual).digest();
  return timingSafeEqual(expectedHash, actualHash);
}

function hasValidProvisioningSecret(req: Request): boolean {
  const expectedSecret = config.iotDeviceProvisioningSecret;
  const providedSecret = getHeaderValue(req, "x-device-provisioning-secret");

  return Boolean(
    expectedSecret &&
      providedSecret &&
      secretsMatch(expectedSecret, providedSecret)
  );
}

function hasRequiredProvisioningSecret(req: Request): boolean {
  return !config.iotDeviceProvisioningSecret || hasValidProvisioningSecret(req);
}

function attachDevice(req: Request, device: Device): void {
  req.device = {
    id: device.id,
    deviceId: device.deviceId,
    elderProfileId: device.elderProfileId,
  };
}

async function registerUnclaimedDevice(deviceKey: string): Promise<Device> {
  try {
    return await createUnclaimedDeviceRecord(deviceKey);
  } catch (error) {
    const existingDevice = await findDeviceByKeyForAuth(deviceKey);

    if (existingDevice) return existingDevice;
    throw error;
  }
}

export async function authenticateDevice(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const deviceKey = getDeviceKey(req);
  if (!deviceKey) {
    sendError(res, "Device key tidak ditemukan", 401);
    return;
  }

  if (!hasRequiredProvisioningSecret(req)) {
    sendError(res, "Device key tidak valid", 401);
    return;
  }

  const device = await findDeviceByKeyForAuth(deviceKey);
  if (!device) {
    sendError(res, "Device key tidak valid", 401);
    return;
  }

  attachDevice(req, device);
  next();
}

export async function authenticateOrRegisterDevice(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const deviceKey = getDeviceKey(req);
  if (!deviceKey) {
    sendError(res, "Device key tidak ditemukan", 401);
    return;
  }

  const device = await findDeviceByKeyForAuth(deviceKey);
  if (!device && !hasValidProvisioningSecret(req)) {
    sendError(res, "Device key tidak valid", 401);
    return;
  }

  if (device && !hasRequiredProvisioningSecret(req)) {
    sendError(res, "Device key tidak valid", 401);
    return;
  }

  attachDevice(req, device ?? (await registerUnclaimedDevice(deviceKey)));
  next();
}
