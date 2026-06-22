import { z } from "zod";

const triggerTypeSchema = z.enum([
  "tap_to_run",
  "device_status_changes",
  "schedule",
  "weather_changes",
  "family_member_going_home",
]);

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must use HH:mm format");

const sceneConditionSchema = z
  .object({
    kind: z.enum([
      "manual_tap",
      "fall_detected",
      "device_offline",
      "schedule",
    ]),
    deviceType: z.enum(["dorabot", "dorashield", "any"]).optional(),
    durationMinutes: z.number().int().min(1).max(1440).optional(),
    activeHoursOnly: z.boolean().optional(),
    schedule: z
      .object({
        frequency: z.enum(["daily", "weekly"]),
        time: timeSchema,
        weekday: z.number().int().min(0).max(6).optional(),
        weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
      })
      .optional(),
  })
  .passthrough();

const deviceBindingsSchema = z
  .object({
    dorabot: z.string().trim().min(1).optional(),
    dorashield: z.string().trim().min(1).optional(),
    caregiver_app: z.string().trim().min(1).optional(),
  })
  .partial();

export const sceneTriggerConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    deviceBindings: deviceBindingsSchema.optional(),
    condition: sceneConditionSchema.optional(),
    conditions: z.array(sceneConditionSchema).optional(),
  })
  .passthrough();

const sceneActionSchema = z
  .object({
    type: z.enum([
      "send_push_alert",
      "send_push_alert_if_no_response",
      "activate_local_alarm",
      "dorabot_voice_check_in",
      "show_call_elder_action",
      "speak_on_dorabot",
    ]),
    target: z.enum(["caregiver", "dorabot", "dorashield"]).optional(),
    message: z.string().trim().max(240).optional(),
    delayMinutes: z.number().int().min(1).max(1440).optional(),
    notificationType: z.enum(["alarm", "home", "device"]).optional(),
    title: z.string().trim().min(1).max(120).optional(),
    body: z.string().trim().max(240).optional(),
    severity: z.enum(["normal", "warning", "critical"]).optional(),
    sound: z.string().trim().min(1).max(80).optional(),
  })
  .passthrough();

export const sceneActionsSchema = z
  .object({
    schemaVersion: z.literal(1),
    deviceBindings: deviceBindingsSchema.optional(),
    steps: z.array(sceneActionSchema),
  })
  .passthrough();

export const listScenesSchema = z.object({
  homeId: z.string().trim().min(1, "Home is required"),
  mode: z.enum(["automation", "tap"]).optional(),
  roomCategoryId: z.string().trim().min(1).optional(),
});

export const createSceneSchema = z.object({
  homeId: z.string().trim().min(1, "Home is required"),
  name: z.string().trim().min(1).max(80).optional(),
  triggerType: triggerTypeSchema,
  roomCategoryId: z.string().trim().min(1).nullable().optional(),
  triggerConfig: sceneTriggerConfigSchema.optional(),
  actions: sceneActionsSchema.optional(),
  isEnabled: z.boolean().optional(),
});

export const updateSceneSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  triggerType: triggerTypeSchema.optional(),
  roomCategoryId: z.string().trim().min(1).nullable().optional(),
  triggerConfig: sceneTriggerConfigSchema.optional(),
  actions: sceneActionsSchema.optional(),
  isEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type ListScenesInput = z.infer<typeof listScenesSchema>;
export type CreateSceneInput = z.infer<typeof createSceneSchema>;
export type UpdateSceneInput = z.infer<typeof updateSceneSchema>;
