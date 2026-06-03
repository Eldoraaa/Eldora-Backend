import { prisma } from "@/config/database";
import type { Prisma, SceneTriggerType } from "../../../generated/prisma/client";
import type {
  CreateSceneInput,
  ListScenesInput,
  UpdateSceneInput,
} from "./scenes.validation";

function modeWhere(mode?: ListScenesInput["mode"]) {
  if (mode === "tap") return { triggerType: "tap_to_run" as const };
  if (mode === "automation") return { triggerType: { not: "tap_to_run" as const } };
  return {};
}

export function findScenes(userId: string, input: ListScenesInput) {
  return prisma.msScene.findMany({
    where: {
      homeId: input.homeId,
      home: { members: { some: { userId } } },
      ...(input.roomCategoryId && { roomCategoryId: input.roomCategoryId }),
      ...modeWhere(input.mode),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      roomCategory: { select: { id: true, name: true, slug: true } },
    },
  });
}

export function findSceneById(userId: string, sceneId: string) {
  return prisma.msScene.findFirst({
    where: {
      id: sceneId,
      home: { members: { some: { userId } } },
    },
    include: {
      roomCategory: { select: { id: true, name: true, slug: true } },
    },
  });
}

export function findExecutableSceneById(userId: string, sceneId: string) {
  return prisma.msScene.findFirst({
    where: {
      id: sceneId,
      home: { members: { some: { userId } } },
      isEnabled: true,
    },
    include: {
      home: { include: { members: { select: { userId: true } } } },
      roomCategory: { select: { id: true, name: true, slug: true } },
    },
  });
}

export function findEnabledScheduleScenes() {
  return prisma.msScene.findMany({
    where: {
      triggerType: "schedule",
      isEnabled: true,
    },
    include: {
      home: { include: { members: { select: { userId: true } } } },
      roomCategory: { select: { id: true, name: true, slug: true } },
    },
  });
}

export function findEnabledScenesForHomeEvent(
  homeId: string,
  triggerType: SceneTriggerType
) {
  return prisma.msScene.findMany({
    where: {
      homeId,
      triggerType,
      isEnabled: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      home: { include: { members: { select: { userId: true } } } },
      roomCategory: { select: { id: true, name: true, slug: true } },
    },
  });
}

export function createScene(userId: string, input: CreateSceneInput) {
  const triggerConfig = (input.triggerConfig ?? {}) as Prisma.InputJsonValue;
  const actions = (input.actions ?? {}) as Prisma.InputJsonValue;

  return prisma.msScene.create({
    data: {
      homeId: input.homeId,
      createdById: userId,
      name: input.name ?? "New Scene",
      triggerType: input.triggerType,
      roomCategoryId: input.roomCategoryId ?? null,
      triggerConfig,
      actions,
      isEnabled: input.isEnabled ?? true,
    },
    include: {
      roomCategory: { select: { id: true, name: true, slug: true } },
    },
  });
}

export function updateScene(sceneId: string, input: UpdateSceneInput) {
  const triggerConfig =
    input.triggerConfig === undefined
      ? undefined
      : (input.triggerConfig as Prisma.InputJsonValue);
  const actions =
    input.actions === undefined
      ? undefined
      : (input.actions as Prisma.InputJsonValue);

  return prisma.msScene.update({
    where: { id: sceneId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.triggerType !== undefined && { triggerType: input.triggerType }),
      ...(input.roomCategoryId !== undefined && {
        roomCategory: input.roomCategoryId
          ? { connect: { id: input.roomCategoryId } }
          : { disconnect: true },
      }),
      ...(triggerConfig !== undefined && { triggerConfig }),
      ...(actions !== undefined && { actions }),
      ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
    include: {
      roomCategory: { select: { id: true, name: true, slug: true } },
    },
  });
}

export function deleteScene(sceneId: string) {
  return prisma.msScene.delete({ where: { id: sceneId } });
}
