import { Router } from "express";
import {
  acknowledgeCommand,
  getCommands,
  postHeartbeat,
} from "@/controllers/iot.controller";
import { authenticateDevice } from "@/middlewares/device.middleware";

const router = Router();

router.post("/heartbeat", authenticateDevice, postHeartbeat);
router.get("/commands", authenticateDevice, getCommands);
router.post("/commands/:id/ack", authenticateDevice, acknowledgeCommand);

export default router;
