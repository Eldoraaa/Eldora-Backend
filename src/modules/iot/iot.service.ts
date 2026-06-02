import { AppError } from "@/shared/errors";
import { hashLocalPairingToken } from "@/shared/security";
import { DeviceTelemetry } from "@/types/iot.types";
import { findDeviceById } from "@/modules/devices/devices.repository";
import { findFirstUserHome } from "@/modules/home/home.repository";
import { createUserNotification } from "@/modules/notifications/notifications.service";
import { findEnabledScenesForHomeEvent } from "@/modules/scenes/scenes.repository";
import { SceneTriggerType } from "../../../generated/prisma/client";
import {
  findCommandForDevice,
  findPendingCommands,
  markCommandsDelivered,
  updateCommand,
  updateDevice,
} from "./iot.repository";

type FallEventInput = {
  confidence?: number;
  occurredAt?: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
};

type DeviceOfflineEventInput = {
  occurredAt?: Date;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function sceneActionSteps(actions: unknown) {
  const actionRecord = asRecord(actions);
  const steps = actionRecord?.steps;
  return Array.isArray(steps)
    ? steps.map(asRecord).filter((step): step is JsonRecord => Boolean(step))
    : [];
}

function sceneConditions(triggerConfig: unknown) {
  const config = asRecord(triggerConfig);
  const conditions = config?.conditions;
  if (Array.isArray(conditions)) {
    return conditions
      .map(asRecord)
      .filter((condition): condition is JsonRecord => Boolean(condition));
  }

  const legacyCondition = asRecord(config?.condition);
  return legacyCondition ? [legacyCondition] : [];
}

function sceneDeviceBindings(triggerConfig: unknown, actions: unknown) {
  return {
    ...asRecord(asRecord(triggerConfig)?.deviceBindings),
    ...asRecord(asRecord(actions)?.deviceBindings),
  };
}

function sceneMatchesDevice(
  scene: Awaited<ReturnType<typeof findEnabledScenesForHomeEvent>>[number],
  conditionKind: string,
  deviceType: "aegiswear" | "eldora_core",
  deviceId: string
) {
  const conditions = sceneConditions(scene.triggerConfig);
  const bindings = sceneDeviceBindings(scene.triggerConfig, scene.actions);
  return conditions.some((condition) =>
    condition?.kind === conditionKind &&
    condition.deviceType === deviceType &&
    (!bindings[deviceType] || bindings[deviceType] === deviceId)
  );
}

async function findMatchingDeviceScenes(
  homeId: string,
  conditionKind: string,
  deviceType: "aegiswear" | "eldora_core",
  deviceId: string
) {
  const scenes = await findEnabledScenesForHomeEvent(
    homeId,
    SceneTriggerType.device_status_changes
  );
  return scenes.filter((scene) =>
    sceneMatchesDevice(scene, conditionKind, deviceType, deviceId)
  );
}

function notificationActionFromScene(
  scene: Awaited<ReturnType<typeof findEnabledScenesForHomeEvent>>[number] | undefined
) {
  return sceneActionSteps(scene?.actions).find((step) => {
    const type = asString(step?.type);
    return type === "send_push_alert" || type === "send_push_alert_if_no_response";
  }) ?? undefined;
}

function notificationInputFromAction(
  action: JsonRecord | undefined,
  fallback: {
    title: string;
    body: string;
    type: "alarm" | "home" | "device";
    severity: "normal" | "warning" | "critical";
    sound?: string;
  }
) {
  const type = asString(action?.notificationType) as
    | "alarm"
    | "home"
    | "device"
    | undefined;
  const severity = asString(action?.severity) as
    | "normal"
    | "warning"
    | "critical"
    | undefined;

  return {
    type: type ?? fallback.type,
    title: asString(action?.title) ?? fallback.title,
    body: asString(action?.body) ?? fallback.body,
    severity: severity ?? fallback.severity,
    sound: asString(action?.sound) ?? fallback.sound,
    delayMinutes: asNumber(action?.delayMinutes),
  };
}

export async function updateDeviceHeartbeat(
  deviceId: string,
  telemetry: DeviceTelemetry
): Promise<void> {
  await updateDevice(deviceId, {
    isOnline: true,
    lastSeen: new Date(),
    ...(telemetry.batteryLevel !== undefined && {
      batteryLevel: telemetry.batteryLevel,
    }),
    ...(telemetry.isCharging !== undefined && {
      isCharging: telemetry.isCharging,
    }),
    ...(telemetry.wifiSsid !== undefined && { wifiSsid: telemetry.wifiSsid }),
    ...(telemetry.wifiRssi !== undefined && { wifiRssi: telemetry.wifiRssi }),
    ...(telemetry.localIp !== undefined && { localIp: telemetry.localIp }),
    ...(telemetry.localPairingToken !== undefined && {
      localPairingToken: hashLocalPairingToken(telemetry.localPairingToken),
      localPairingTokenUpdatedAt: new Date(),
    }),
    ...(telemetry.firmwareVersion !== undefined && {
      firmwareVersion: telemetry.firmwareVersion,
    }),
  });
}

export async function getPendingCommands(deviceId: string) {
  const commands = await findPendingCommands(deviceId);

  if (commands.length > 0) {
    await markCommandsDelivered(commands.map((command) => command.id));
  }

  return commands.map((command) => ({
    id: command.id,
    commandType: command.commandType,
    payload: command.payload,
    createdAt: command.createdAt,
  }));
}

export async function acknowledgeCommand(
  deviceId: string,
  commandId: string,
  body: { status: "applied" | "failed"; message?: string }
): Promise<void> {
  const command = await findCommandForDevice(commandId, deviceId);

  if (!command) {
    throw new AppError("Command not found", 404);
  }

  const currentPayload =
    typeof command.payload === "object" &&
    command.payload !== null &&
    !Array.isArray(command.payload)
      ? command.payload
      : {};

  await updateCommand(command.id, {
    status: body.status,
    appliedAt: body.status === "applied" ? new Date() : undefined,
    payload: {
      ...currentPayload,
      ...(body.message ? { resultMessage: body.message } : {}),
    },
  });
}

export async function reportFallEvent(
  deviceId: string,
  input: FallEventInput
): Promise<void> {
  const device = await findDeviceById(deviceId);
  const caregiverIds = device.elderProfile.userLinks.map((link) => link.userId);

  await Promise.all(
    caregiverIds.map(async (userId) => {
      const homeId = device.roomCategory?.homeId;
      const home = homeId ? { id: homeId } : await findFirstUserHome(userId);
      const scenes = home
        ? await findMatchingDeviceScenes(
            home.id,
            "fall_detected",
            "aegiswear",
            device.id
          )
        : [];
      const matchedScenes = scenes.length > 0 ? scenes : [undefined];

      await Promise.all(
        matchedScenes.map(async (scene) => {
          const action = notificationActionFromScene(scene);
          const notification = notificationInputFromAction(action, {
            type: "alarm",
            title: "Fall detected",
            body: `${device.name ?? "AegisWear"} detected a fall. Check immediately.`,
            severity: "critical",
            sound: "critical_alert",
          });

          await createUserNotification({
            userId,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            homeId: home?.id ?? null,
            deviceId: device.id,
            metadata: {
              eventType: "fall_detected",
              severity: notification.severity,
              sound: notification.sound,
              sceneId: scene?.id ?? null,
              confidence: input.confidence ?? null,
              occurredAt: input.occurredAt?.toISOString() ?? new Date().toISOString(),
              location: input.location ?? null,
            },
          });
        })
      );
    })
  );
}

export async function reportDeviceOfflineEvent(
  deviceId: string,
  input: DeviceOfflineEventInput
): Promise<void> {
  const device = await findDeviceById(deviceId);
  const caregiverIds = device.elderProfile.userLinks.map((link) => link.userId);

  await updateDevice(device.id, {
    isOnline: false,
    lastSeen: input.occurredAt ?? device.lastSeen ?? new Date(),
  });

  await Promise.all(
    caregiverIds.map(async (userId) => {
      const homeId = device.roomCategory?.homeId;
      const home = homeId ? { id: homeId } : await findFirstUserHome(userId);
      const scenes = home
        ? await findMatchingDeviceScenes(
            home.id,
            "device_offline",
            "eldora_core",
            device.id
          )
        : [];
      const matchedScenes = scenes.length > 0 ? scenes : [undefined];

      await Promise.all(
        matchedScenes.map(async (scene) => {
          const action = notificationActionFromScene(scene);
          const notification = notificationInputFromAction(action, {
            type: "device",
            title: "Eldora Core offline",
            body: `${device.name ?? "Eldora Core"} has been offline for 10 minutes.`,
            severity: "warning",
          });

          await createUserNotification({
            userId,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            homeId: home?.id ?? null,
            deviceId: device.id,
            metadata: {
              eventType: "device_offline",
              severity: notification.severity,
              sound: notification.sound ?? null,
              sceneId: scene?.id ?? null,
              occurredAt: input.occurredAt?.toISOString() ?? new Date().toISOString(),
            },
          });
        })
      );
    })
  );
}
