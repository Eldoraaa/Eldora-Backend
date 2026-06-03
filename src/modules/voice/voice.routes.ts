import express, { Router } from "express";
import { authenticateDevice } from "@/middlewares";
import { processDeviceVoiceAudioController } from "./voice.controller";

const router = Router();

router.post(
  "/device/process-audio",
  authenticateDevice,
  express.raw({ type: "*/*", limit: "2mb" }),
  processDeviceVoiceAudioController
);

export default router;
