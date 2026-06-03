import { Router } from "express";
import { authenticate } from "@/middlewares";
import {
  getNotificationController,
  getNotificationPreferenceController,
  listNotificationsController,
  readAllNotificationsController,
  readNotificationController,
  respondNotificationController,
  resolveNotificationController,
  updateNotificationPreferenceController,
} from "./notifications.controller";

const router = Router();

router.get("/", authenticate, listNotificationsController);
router.get("/preferences", authenticate, getNotificationPreferenceController);
router.get("/:id", authenticate, getNotificationController);
router.patch("/preferences", authenticate, updateNotificationPreferenceController);
router.patch("/read-all", authenticate, readAllNotificationsController);
router.patch("/:id/read", authenticate, readNotificationController);
router.patch("/:id/respond", authenticate, respondNotificationController);
router.patch("/:id/resolve", authenticate, resolveNotificationController);

export default router;
