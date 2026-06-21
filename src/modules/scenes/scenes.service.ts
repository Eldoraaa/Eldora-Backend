import { AppError } from "@/shared/errors";
import { createUserNotification } from "@/modules/notifications/notifications.service";
import { createDeviceCommand } from "@/modules/iot/iot.repository";
import { DeviceCommandType } from "../../../generated/prisma/client";
import { findUserHomeById } from "@/modules/home/home.repository";
import { findDevicesByUser } from "@/modules/devices/devices.repository";
import { findRoomCategories } from "@/modules/devices/rooms.repository";
import {
  createScene,
  deleteScene,
  findEnabledScheduleScenes,
  findExecutableSceneById,
  findSceneById,
  findScenes,
  updateScene,
} from "./scenes.repository";
import type {
  CreateSceneInput,
  ListScenesInput,
  UpdateSceneInput,
} from "./scenes.validation";
import { SCENE_TEMPLATES } from "./scenes.templates";

function sceneMode(triggerType: string) {
  return triggerType === "tap_to_run" ? "tap" : "automation";
}

function triggerLabel(triggerType: string) {
  if (triggerType === "tap_to_run") return "Tap-to-Run";
  if (triggerType === "device_status_changes") return "Device Status";
  if (triggerType === "schedule") return "Schedule";
  if (triggerType === "weather_changes") return "Weather";
  return "Family Going Home";
}

type SceneWithRoom = Awaited<ReturnType<typeof findScenes>>[number];

function buildSceneResponse(scene: SceneWithRoom) {
  return {
    id: scene.id,
    homeId: scene.homeId,
    name: scene.name,
    mode: sceneMode(scene.triggerType),
    triggerType: scene.triggerType,
    triggerLabel: triggerLabel(scene.triggerType),
    triggerConfig: scene.triggerConfig,
    actions: scene.actions,
    isEnabled: scene.isEnabled,
    sortOrder: scene.sortOrder,
    roomCategory: scene.roomCategory,
    createdAt: scene.createdAt,
    updatedAt: scene.updatedAt,
  };
}

function collectDeviceBindingIds(...values: unknown[]) {
  const ids = new Set<string>();
  values.forEach((value) => {
    const bindings = asRecord(asRecord(value).deviceBindings);
    Object.entries(bindings).forEach(([key, id]) => {
      if (key === "caregiver_app") return;
      if (typeof id === "string" && id.trim()) ids.add(id);
    });
  });
  return Array.from(ids);
}

async function assertSceneScope(
  userId: string,
  homeId: string,
  input: { roomCategoryId?: string | null; triggerConfig?: unknown; actions?: unknown }
) {
  if (input.roomCategoryId) {
    const rooms = await findRoomCategories(homeId);
    if (!rooms.some((room) => room.id === input.roomCategoryId)) {
      throw new AppError("Room not found", 404);
    }
  }

  const bindingIds = collectDeviceBindingIds(input.triggerConfig, input.actions);
  if (bindingIds.length === 0) return;

  const devices = await findDevicesByUser(userId, homeId);
  const deviceIds = new Set(devices.map((device) => device.id));
  if (bindingIds.some((deviceId) => !deviceIds.has(deviceId))) {
    throw new AppError("Device not found", 404);
  }
}

export async function getScenes(userId: string, input: ListScenesInput) {
  const scenes = await findScenes(userId, input);
  return scenes.map(buildSceneResponse);
}

export async function getScene(userId: string, sceneId: string) {
  const scene = await findSceneById(userId, sceneId);
  if (!scene) throw new AppError("Scene not found", 404);
  return buildSceneResponse(scene);
}

export function getSceneTemplates() {
  return SCENE_TEMPLATES;
}

export async function createSceneForHome(
  userId: string,
  input: CreateSceneInput
) {
  const home = await findUserHomeById(userId, input.homeId);
  if (!home) throw new AppError("Home not found", 404);
  await assertSceneScope(userId, home.id, input);

  const scene = await createScene(userId, {
    ...input,
    name: input.name ?? triggerLabel(input.triggerType),
  });
  return buildSceneResponse(scene);
}

export async function updateUserScene(
  userId: string,
  sceneId: string,
  input: UpdateSceneInput
) {
  const scene = await findSceneById(userId, sceneId);
  if (!scene) throw new AppError("Scene not found", 404);
  await assertSceneScope(userId, scene.homeId, input);

  const updated = await updateScene(scene.id, input);
  return buildSceneResponse(updated);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sceneSchedule(scene: Awaited<ReturnType<typeof findEnabledScheduleScenes>>[number]) {
  const config = asRecord(scene.triggerConfig);
  const condition = asRecord(config.condition);
  const schedule = asRecord(condition.schedule);
  return {
    frequency: asString(schedule.frequency) ?? "daily",
    time: asString(schedule.time),
    weekday: typeof schedule.weekday === "number" ? schedule.weekday : undefined,
  };
}

function sceneActionSteps(actions: unknown) {
  const actionRecord = asRecord(actions);
  return Array.isArray(actionRecord.steps)
    ? actionRecord.steps.map(asRecord)
    : [];
}

function sceneDeviceBindings(triggerConfig: unknown, actions: unknown) {
  return {
    ...asRecord(asRecord(triggerConfig).deviceBindings),
    ...asRecord(asRecord(actions).deviceBindings),
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

type ExecutableScene = Awaited<ReturnType<typeof findEnabledScheduleScenes>>[number];

export async function executeSceneActions(
  scene: ExecutableScene,
  eventType: string,
  fallbackDeviceId?: string
) {
  const steps = sceneActionSteps(scene.actions);
  const bindings = sceneDeviceBindings(scene.triggerConfig, scene.actions);

  await Promise.all(
    steps.map(async (step) => {
      const type = asString(step.type);
      if (type === "send_push_alert" || type === "send_push_alert_if_no_response") {
        await Promise.all(
          scene.home.members.map((member) =>
            createUserNotification({
              userId: member.userId,
              type: step.notificationType === "alarm" || step.notificationType === "device"
                ? step.notificationType
                : "home",
              title: asString(step.title) ?? scene.name,
              body: asString(step.body) ?? "Eldora scene triggered.",
              homeId: scene.homeId,
              deviceId: fallbackDeviceId ?? null,
              metadata: {
                eventType,
                severity: asString(step.severity) ?? "normal",
                sceneId: scene.id,
                occurredAt: new Date().toISOString(),
                showCallAction: steps.some((item) => item.type === "show_call_elder_action"),
                followUpAt: type === "send_push_alert_if_no_response" && typeof step.delayMinutes === "number"
                  ? new Date(Date.now() + step.delayMinutes * 60 * 1000).toISOString()
                  : null,
              },
            })
          )
        );
        return;
      }

      const targetDeviceId =
        step.target === "dorashield"
          ? asString(bindings.dorashield) ?? fallbackDeviceId
          : step.target === "dorabot"
            ? asString(bindings.dorabot) ?? fallbackDeviceId
            : undefined;

      if (!targetDeviceId) return;

      if (type === "activate_local_alarm") {
        await createDeviceCommand(targetDeviceId, DeviceCommandType.activate_local_alarm, {
          source: "scene",
          sceneId: scene.id,
        });
      }
      if (type === "speak_on_dorabot" || type === "dorabot_voice_check_in") {
        await createDeviceCommand(targetDeviceId, DeviceCommandType.speak_on_dorabot, {
          source: "scene",
          sceneId: scene.id,
          message: asString(step.message) ?? "Your family is checking in. Are you feeling okay?",
        });
      }
    })
  );
}

export async function executeUserScene(userId: string, sceneId: string) {
  const scene = await findExecutableSceneById(userId, sceneId);
  if (!scene) throw new AppError("Scene not found", 404);
  if (scene.triggerType !== "tap_to_run") {
    throw new AppError("Only tap-to-run scenes can be executed manually", 400);
  }
  await executeSceneActions(scene, "manual_scene");
}

export async function processDueScheduledScenes() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const runKey = now.toISOString().slice(0, 16);
  const scenes = await findEnabledScheduleScenes();

  await Promise.all(
    scenes.map(async (scene) => {
      const schedule = sceneSchedule(scene);
      if (schedule.time !== currentTime) return;
      if (schedule.frequency === "weekly" && schedule.weekday !== now.getDay()) return;
      const triggerConfig = asRecord(scene.triggerConfig);
      if (triggerConfig.lastRunKey === runKey) return;

      await executeSceneActions(scene, "scheduled_scene");

      await updateScene(scene.id, {
        triggerConfig: {
          schemaVersion: 1,
          ...triggerConfig,
          lastRunKey: runKey,
        },
      });
    })
  );
}

export async function deleteUserScene(userId: string, sceneId: string) {
  const scene = await findSceneById(userId, sceneId);
  if (!scene) throw new AppError("Scene not found", 404);
  await deleteScene(scene.id);
}
