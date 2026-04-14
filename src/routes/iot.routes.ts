import { Router } from "express";
import { postEvent, postHeartbeat } from "@/controllers/iot.controller";
import { authenticateDevice } from "@/middlewares/device.middleware";

const router = Router();

router.post("/events", authenticateDevice, postEvent);
router.post("/heartbeat", authenticateDevice, postHeartbeat);

export default router;
