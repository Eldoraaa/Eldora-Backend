import { Router } from "express";
import {
  authenticateDevice,
  authenticateOrRegisterDevice,
} from "@/middlewares";
import {
  acknowledgeCommand,
  getCommands,
  postHeartbeat,
} from "./iot.controller";

const router = Router();

router.post("/heartbeat", authenticateOrRegisterDevice, postHeartbeat);

router.get("/commands", authenticateDevice, getCommands);

router.post("/commands/:id/ack", authenticateDevice, acknowledgeCommand);

export default router;
