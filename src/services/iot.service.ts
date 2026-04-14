import { EventType } from "../../generated/prisma/client";
import { prisma } from "@/config/database";
import { processDeviceEvent } from "./alert.service";

const PRIORITY_MAP: Record<EventType, string> = {
  emergency: "critical",
  assistance_request: "high",
  sensor_anomaly: "high",
  service_request: "medium",
  device_status: "low",
};

export async function processEvent(
  deviceId: string,
  elderProfileId: string,
  eventType: EventType,
  payload: Record<string, unknown>
): Promise<{ eventId: string }> {
  const priority = PRIORITY_MAP[eventType] as any;

  const event = await prisma.deviceEvent.create({
    data: {
      eventType,
      priority,
      payload: payload as object,
      deviceId,
    },
  });

  // Process alert async — don't block response
  processDeviceEvent(event.id, eventType, payload, elderProfileId).catch((err) =>
    console.error("[IoT] processDeviceEvent error:", err)
  );

  return { eventId: event.id };
}

export async function processHeartbeat(deviceId: string): Promise<void> {
  await prisma.device.update({
    where: { id: deviceId },
    data: { isOnline: true, lastSeen: new Date() },
  });
}
