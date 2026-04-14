import { Router } from "express";
import { getAlerts, getAlertById, acknowledgeAlert } from "@/controllers/alerts.controller";
import { authenticate } from "@/middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, getAlerts);
router.get("/:id", authenticate, getAlertById);
router.patch("/:id/acknowledge", authenticate, acknowledgeAlert);

export default router;
