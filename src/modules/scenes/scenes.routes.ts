import { Router } from "express";
import { authenticate } from "@/middlewares";
import {
  createSceneController,
  deleteSceneController,
  executeSceneController,
  getSceneController,
  listSceneTemplatesController,
  listScenesController,
  updateSceneController,
} from "./scenes.controller";

const router = Router();

router.get("/", authenticate, listScenesController);
router.get("/templates", authenticate, listSceneTemplatesController);
router.get("/:id", authenticate, getSceneController);
router.post("/", authenticate, createSceneController);
router.post("/:id/execute", authenticate, executeSceneController);
router.patch("/:id", authenticate, updateSceneController);
router.delete("/:id", authenticate, deleteSceneController);

export default router;
