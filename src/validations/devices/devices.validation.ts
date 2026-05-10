import { z } from "zod";

export const pairDeviceSchema = z.object({
  deviceKey: z.string().trim().min(4, "Device code is required"),
  elderName: z.string().trim().min(2).max(80).optional(),
  deviceName: z.string().trim().min(2).max(80).optional(),
});

export const localPairDeviceSchema = z.object({
  deviceKey: z.string().trim().min(4, "Device code is required"),
  pairingToken: z.string().trim().min(8, "Pairing token is required").max(80),
  elderName: z.string().trim().min(2).max(80).optional(),
  deviceName: z.string().trim().min(2).max(80).optional(),
  localIp: z.string().trim().max(45).optional(),
});

export const wifiCommandSchema = z.object({
  ssid: z.string().trim().min(1, "WiFi name is required").max(32),
  password: z.string().max(63).optional().default(""),
});
