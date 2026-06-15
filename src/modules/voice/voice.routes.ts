import express, { Router } from "express";
import { authenticate, authenticateDevice } from "@/middlewares";
import { processDeviceVoiceAudioController, testSpeakController } from "./voice.controller";

const router = Router();

router.post(
  "/device/process-audio",
  authenticateDevice,
  express.raw({ type: "*/*", limit: "2mb" }),
  processDeviceVoiceAudioController
);

router.post("/test-speak", authenticate, testSpeakController);

export default router;
