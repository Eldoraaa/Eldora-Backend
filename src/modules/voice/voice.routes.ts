import { Router } from "express";
import { authenticate, authenticateDevice } from "@/middlewares";
import {
  processDeviceVoiceTextController,
  processVoiceTextController,
} from "./voice.controller";

const router = Router();

router.post("/process-text", authenticate, processVoiceTextController);
router.post("/device/process-text", authenticateDevice, processDeviceVoiceTextController);

export default router;
