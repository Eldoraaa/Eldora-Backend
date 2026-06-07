import { AppError } from "@/shared/errors";
import { hashLocalPairingToken } from "@/shared/security";
import { DeviceTelemetry } from "@/types/iot.types";
import { findDeviceById } from "@/modules/devices/devices.repository";
import { findFirstUserHome } from "@/modules/home/home.repository";
import { findRecentDeviceEventNotification } from "@/modules/notifications/notifications.repository";
import { createUserNotification } from "@/modules/notifications/notifications.service";
import { findEnabledScenesForHomeEvent } from "@/modules/scenes/scenes.repository";
import { executeSceneActions } from "@/modules/scenes/scenes.service";
import { DeviceCommandType, Prisma, SceneTriggerType } from "../../../generated/prisma/client";
import {
  createDeviceCommand,
  findCommandForDevice,
  findStaleOnlineDevices,
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
type SceneDeviceCommand = {
  deviceId: string;
  commandType: DeviceCommandType;
  payload: Prisma.InputJsonValue;
};

function isDatabaseReachabilityError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "P1001" || code === "P1002";
}

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

function deviceTypeFromDevice(device: { name: string | null; deviceId: string }) {
  const haystack = `${device.name ?? ""} ${device.deviceId}`.toLowerCase();
  return haystack.includes("dorashield") || haystack.includes("shield") || haystack.includes("vest") ? "dorashield" : "dorabot";
}

function sceneMatchesDevice(
  scene: Awaited<ReturnType<typeof findEnabledScenesForHomeEvent>>[number],
  conditionKind: string,
  deviceType: "dorashield" | "dorabot",
  deviceId: string
) {
  const conditions = sceneConditions(scene.triggerConfig);
  const bindings = sceneDeviceBindings(scene.triggerConfig, scene.actions);
  return conditions.some((condition) =>
    condition?.kind === conditionKind &&
    (condition.deviceType === "any" || condition.deviceType === deviceType) &&
    (!bindings[deviceType] || bindings[deviceType] === deviceId)
  );
}

async function findMatchingDeviceScenes(
  homeId: string,
  conditionKind: string,
  deviceType: "dorashield" | "dorabot",
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

function sceneActionTypes(scene: Awaited<ReturnType<typeof findEnabledScenesForHomeEvent>>[number] | undefined) {
  return sceneActionSteps(scene?.actions)
    .map((step) => asString(step.type))
    .filter((type): type is string => Boolean(type));
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

function targetDeviceIdForAction(
  step: JsonRecord,
  bindings: JsonRecord,
  fallbackDeviceType: "dorashield" | "dorabot",
  fallbackDeviceId: string
) {
  const target = asString(step.target);
  if (target === "dorashield") {
    return asString(bindings.dorashield) ?? (fallbackDeviceType === "dorashield" ? fallbackDeviceId : undefined);
  }
  if (target === "dorabot") {
    return asString(bindings.dorabot) ?? (fallbackDeviceType === "dorabot" ? fallbackDeviceId : undefined);
  }
  return undefined;
}

async function queueSceneDeviceActions(
  scene: Awaited<ReturnType<typeof findEnabledScenesForHomeEvent>>[number] | undefined,
  fallbackDeviceType: "dorashield" | "dorabot",
  fallbackDeviceId: string
) {
  if (!scene) return;

  const bindings = sceneDeviceBindings(scene.triggerConfig, scene.actions);
  const commands: SceneDeviceCommand[] = sceneActionSteps(scene.actions).flatMap((step): SceneDeviceCommand[] => {
    const type = asString(step.type);
    const deviceId = targetDeviceIdForAction(step, bindings, fallbackDeviceType, fallbackDeviceId);
    if (!deviceId) return [];

    if (type === "activate_local_alarm") {
      return [{ deviceId, commandType: DeviceCommandType.activate_local_alarm, payload: { source: "scene", sceneId: scene.id } }];
    }
    if (type === "speak_on_dorabot" || type === "dorabot_voice_check_in") {
      return [
        {
          deviceId,
          commandType: DeviceCommandType.speak_on_dorabot,
          payload: {
            source: "scene",
            sceneId: scene.id,
            message: asString(step.message) ?? "Your family is checking in. Are you feeling okay?",
          },
        },
      ];
    }

    return [];
  });

  await Promise.all(
    commands.map((command) =>
      createDeviceCommand(command.deviceId, command.commandType, command.payload)
    )
  );
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

export async function processStaleDeviceOfflineEvents() {
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const devices = await findStaleOnlineDevices(cutoff);
    await Promise.all(
      devices.map((device) => reportDeviceOfflineEvent(device.id, { occurredAt: new Date() }))
    );
  } catch (error) {
    if (isDatabaseReachabilityError(error)) {
      console.warn("[IoT] Offline detector skipped: database is not reachable");
      return;
    }
    throw error;
  }
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
            "dorashield",
            device.id
          )
        : [];
      if (scenes.length > 0) {
        await Promise.all(
          scenes.map((scene) => executeSceneActions(scene, "fall_detected", device.id))
        );
        return;
      }

      await createUserNotification({
        userId,
        type: "alarm",
        title: "Fall detected",
        body: `${device.name ?? "DoraShield"} detected a fall. Check immediately.`,
        homeId: home?.id ?? null,
        deviceId: device.id,
        metadata: {
          eventType: "fall_detected",
          severity: "critical",
          sound: "critical_alert",
          sceneId: null,
          confidence: input.confidence ?? null,
          occurredAt: input.occurredAt?.toISOString() ?? new Date().toISOString(),
          location: input.location ?? null,
          showCallAction: true,
          followUpAt: null,
        },
      });
    })
  );
}

export async function reportDeviceOfflineEvent(
  deviceId: string,
  input: DeviceOfflineEventInput
): Promise<void> {
  const device = await findDeviceById(deviceId);
  const caregiverIds = device.elderProfile.userLinks.map((link) => link.userId);
  const deviceType = deviceTypeFromDevice(device);
  const fallbackTitle = deviceType === "dorashield" ? "DoraShield offline" : "DoraBot offline";

  await updateDevice(device.id, {
    isOnline: false,
    lastSeen: input.occurredAt ?? device.lastSeen ?? new Date(),
  });

  await Promise.all(
    caregiverIds.map(async (userId) => {
      const recentOffline = await findRecentDeviceEventNotification(
        userId,
        device.id,
        "device_offline",
        new Date(Date.now() - 30 * 60 * 1000)
      );
      if (recentOffline) return;

      const homeId = device.roomCategory?.homeId;
      const home = homeId ? { id: homeId } : await findFirstUserHome(userId);
      const scenes = home
        ? await findMatchingDeviceScenes(
            home.id,
            "device_offline",
            deviceType,
            device.id
          )
        : [];
      if (scenes.length > 0) {
        await Promise.all(
          scenes.map((scene) => executeSceneActions(scene, "device_offline", device.id))
        );
        return;
      }

      await createUserNotification({
        userId,
        type: "device",
        title: fallbackTitle,
        body: `${device.name ?? fallbackTitle} has been offline for 10 minutes.`,
        homeId: home?.id ?? null,
        deviceId: device.id,
        metadata: {
          eventType: "device_offline",
          severity: "warning",
          sound: null,
          sceneId: null,
          occurredAt: input.occurredAt?.toISOString() ?? new Date().toISOString(),
          showCallAction: false,
          followUpAt: null,
        },
      });
    })
  );
}
