import { AppError } from "@/shared/errors";
import { findUserHomeById } from "@/modules/home/home.repository";
import {
  createScene,
  deleteScene,
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

  const updated = await updateScene(scene.id, input);
  return buildSceneResponse(updated);
}

export async function deleteUserScene(userId: string, sceneId: string) {
  const scene = await findSceneById(userId, sceneId);
  if (!scene) throw new AppError("Scene not found", 404);
  await deleteScene(scene.id);
}
