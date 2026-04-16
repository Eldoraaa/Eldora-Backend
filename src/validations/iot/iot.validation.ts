import { z } from "zod";

export const eventSchema = z.object({
  eventType: z.enum([
    "emergency",
    "assistance_request",
    "service_request",
    "sensor_anomaly",
    "device_status",
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
});
