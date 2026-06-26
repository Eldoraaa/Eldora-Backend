import express, { Router } from "express";
import { authenticate, authenticateDevice } from "@/middlewares";
import {
  acknowledgeElderReminderController,
  approveMemoryFactController,
  cancelElderReminderController,
  getElderReminderController,
  listElderRemindersController,
  listMemoryFactsController,
  processDeviceVoiceAudioController,
  rejectMemoryFactController,
  testSpeakController,
} from "./voice.controller";

const router = Router();

router.post(
  "/device/process-audio",
  authenticateDevice,
  express.raw({ type: "*/*", limit: "2mb" }),
  processDeviceVoiceAudioController
);

router.post("/test-speak", authenticate, testSpeakController);
router.get("/reminders", authenticate, listElderRemindersController);
router.get("/reminders/:id", authenticate, getElderReminderController);
router.patch("/reminders/:id/cancel", authenticate, cancelElderReminderController);
router.patch("/reminders/:id/ack", authenticate, acknowledgeElderReminderController);
router.get("/memory-facts", authenticate, listMemoryFactsController);
router.patch("/memory-facts/:id/approve", authenticate, approveMemoryFactController);
router.patch("/memory-facts/:id/reject", authenticate, rejectMemoryFactController);

export default router;
