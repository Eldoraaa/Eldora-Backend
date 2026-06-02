import { Router } from "express";
import { authenticate } from "@/middlewares";
import {
  getNotificationPreferenceController,
  listNotificationsController,
  readAllNotificationsController,
  readNotificationController,
  updateNotificationPreferenceController,
} from "./notifications.controller";

const router = Router();

router.get("/", authenticate, listNotificationsController);
router.get("/preferences", authenticate, getNotificationPreferenceController);
router.patch("/preferences", authenticate, updateNotificationPreferenceController);
router.patch("/read-all", authenticate, readAllNotificationsController);
router.patch("/:id/read", authenticate, readNotificationController);

export default router;
