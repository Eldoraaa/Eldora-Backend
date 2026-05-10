import { z } from "zod";
import { productionPairingTokenSchema } from "@/validations/shared/pairing-token.validation";

export const heartbeatSchema = z.object({
  batteryLevel: z.number().int().min(0).max(100).optional(),
  isCharging: z.boolean().optional(),
  wifiSsid: z.string().trim().min(1).max(32).optional(),
  wifiRssi: z.number().int().min(-120).max(0).optional(),
  localIp: z.string().trim().max(45).optional(),
  localPairingToken: productionPairingTokenSchema.optional(),
  firmwareVersion: z.string().trim().min(1).max(32).optional(),
}).default({});

export const commandAckSchema = z.object({
  status: z.enum(["applied", "failed"]),
  message: z.string().trim().max(160).optional(),
});
