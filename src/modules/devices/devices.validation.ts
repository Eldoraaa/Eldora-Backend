import { z } from "zod";
import { productionPairingTokenSchema } from "@/shared/validations";

export const pairDeviceSchema = z.object({
  deviceKey: z.string().trim().min(4, "Device code is required"),
  elderName: z.string().trim().min(2).max(80).optional(),
  deviceName: z.string().trim().min(2).max(80).optional(),
  homeId: z.string().trim().min(1).nullable().optional(),
});

export const localPairDeviceSchema = z.object({
  deviceKey: z.string().trim().min(4, "Device code is required"),
  pairingToken: productionPairingTokenSchema,
  elderName: z.string().trim().min(2).max(80).optional(),
  deviceName: z.string().trim().min(2).max(80).optional(),
  homeId: z.string().trim().min(1).nullable().optional(),
  localIp: z.string().trim().max(45).optional(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  isCharging: z.boolean().optional(),
  wifiSsid: z.string().trim().min(1).max(32).optional(),
  wifiRssi: z.number().int().min(-120).max(0).optional(),
  firmwareVersion: z.string().trim().min(1).max(32).optional(),
});

export const wifiCommandSchema = z.object({
  ssid: z.string().trim().min(1, "WiFi name is required").max(32),
  password: z.string().max(63).optional().default(""),
});

export const deviceManagementSchema = z.object({
  homeId: z.string().trim().min(1).nullable().optional(),
  devices: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        sortOrder: z.number().int().min(0).optional(),
        isHidden: z.boolean().optional(),
        roomCategoryId: z.string().trim().min(1).nullable().optional(),
      })
    )
    .min(1),
});
