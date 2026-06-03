import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import {
  createSceneForHome,
  deleteUserScene,
  executeUserScene,
  getScene,
  getScenes,
  getSceneTemplates,
  updateUserScene,
} from "./scenes.service";
import {
  createSceneSchema,
  listScenesSchema,
  updateSceneSchema,
} from "./scenes.validation";

export async function listScenesController(
  req: Request,
  res: Response
): Promise<void> {
  const query = listScenesSchema.parse(req.query);
  const scenes = await getScenes(req.user!.id, query);
  sendSuccess(res, scenes);
}

export async function listSceneTemplatesController(
  _req: Request,
  res: Response
): Promise<void> {
  sendSuccess(res, getSceneTemplates());
}

export async function getSceneController(
  req: Request,
  res: Response
): Promise<void> {
  const scene = await getScene(req.user!.id, req.params.id as string);
  sendSuccess(res, scene);
}

export async function createSceneController(
  req: Request,
  res: Response
): Promise<void> {
  const body = createSceneSchema.parse(req.body);
  const scene = await createSceneForHome(req.user!.id, body);
  sendSuccess(res, scene, "Scene created", 201);
}

export async function updateSceneController(
  req: Request,
  res: Response
): Promise<void> {
  const body = updateSceneSchema.parse(req.body);
  const scene = await updateUserScene(req.user!.id, req.params.id as string, body);
  sendSuccess(res, scene, "Scene updated");
}

export async function executeSceneController(
  req: Request,
  res: Response
): Promise<void> {
  await executeUserScene(req.user!.id, req.params.id as string);
  sendSuccess(res, null, "Scene executed");
}

export async function deleteSceneController(
  req: Request,
  res: Response
): Promise<void> {
  await deleteUserScene(req.user!.id, req.params.id as string);
  sendSuccess(res, null, "Scene deleted");
}
