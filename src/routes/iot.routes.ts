import { Router } from "express";
import {
  acknowledgeCommand,
  getCommands,
  postHeartbeat,
} from "@/controllers/iot.controller";
import {
  authenticateDevice,
  authenticateOrRegisterDevice,
} from "@/middlewares/device.middleware";

const router = Router();

router.post("/heartbeat", authenticateOrRegisterDevice, postHeartbeat);
router.get("/commands", authenticateDevice, getCommands);
router.post("/commands/:id/ack", authenticateDevice, acknowledgeCommand);

export default router;
