import { z } from "zod";
import { productionPairingTokenSchema } from "@/shared/validations";

export const heartbeatSchema = z
  .object({
    batteryLevel: z.number().int().min(0).max(100).optional(),
    isCharging: z.boolean().optional(),
    wifiSsid: z.string().trim().min(1).max(32).optional(),
    wifiRssi: z.number().int().min(-120).max(0).optional(),
    localIp: z.string().trim().max(45).optional(),
    localPairingToken: productionPairingTokenSchema.optional(),
    firmwareVersion: z.string().trim().min(1).max(32).optional(),
  })
  .default({});

export const commandAckSchema = z.object({
  status: z.enum(["applied", "failed"]),
  message: z.string().trim().max(160).optional(),
});

export const fallEventSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  occurredAt: z.coerce.date().optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

export const deviceOfflineEventSchema = z.object({
  occurredAt: z.coerce.date().optional(),
});
