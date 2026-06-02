import { z } from "zod";

export const notificationTypeSchema = z.enum(["alarm", "home", "device"]);

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must use HH:mm format");

export const notificationPreferenceSchema = z.object({
  deviceAlertEnabled: z.boolean().optional(),
  dndEnabled: z.boolean().optional(),
  dndStartTime: timeSchema.nullable().optional(),
  dndEndTime: timeSchema.nullable().optional(),
  systemNotificationEnabled: z.boolean().optional(),
  homeAlertEnabled: z.boolean().optional(),
  fallAlertEnabled: z.boolean().optional(),
  sosAlertEnabled: z.boolean().optional(),
  deviceOfflineAlertEnabled: z.boolean().optional(),
  lowBatteryAlertEnabled: z.boolean().optional(),
  pairingRequestAlertEnabled: z.boolean().optional(),
  bulletinEnabled: z.boolean().optional(),
  fcmToken: z.string().trim().min(1).max(512).nullable().optional(),
  fcmPlatform: z.enum(["ios", "android", "web"]).nullable().optional(),
});

export type NotificationPreferenceInput = z.infer<
  typeof notificationPreferenceSchema
>;

export const listNotificationsSchema = z.object({
  type: notificationTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createNotificationSchema = z.object({
  userId: z.string().trim().min(1),
  type: notificationTypeSchema,
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(240).nullable().optional(),
  homeId: z.string().trim().min(1).nullable().optional(),
  deviceId: z.string().trim().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
