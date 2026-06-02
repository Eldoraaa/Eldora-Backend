import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import {
  getNotificationPreference,
  listUserNotifications,
  readAllUserNotifications,
  readUserNotification,
  saveNotificationPreference,
} from "./notifications.service";
import {
  listNotificationsSchema,
  notificationPreferenceSchema,
} from "./notifications.validation";

export async function getNotificationPreferenceController(
  req: Request,
  res: Response
): Promise<void> {
  const preference = await getNotificationPreference(req.user!.id);
  sendSuccess(res, preference);
}

export async function updateNotificationPreferenceController(
  req: Request,
  res: Response
): Promise<void> {
  const body = notificationPreferenceSchema.parse(req.body);
  const preference = await saveNotificationPreference(req.user!.id, body);
  sendSuccess(res, preference, "Notification settings updated");
}

export async function listNotificationsController(
  req: Request,
  res: Response
): Promise<void> {
  const query = listNotificationsSchema.parse(req.query);
  const notifications = await listUserNotifications(req.user!.id, query);
  sendSuccess(res, notifications);
}

export async function readNotificationController(
  req: Request,
  res: Response
): Promise<void> {
  await readUserNotification(req.user!.id, req.params.id as string);
  sendSuccess(res, null, "Notification marked as read");
}

export async function readAllNotificationsController(
  req: Request,
  res: Response
): Promise<void> {
  await readAllUserNotifications(req.user!.id);
  sendSuccess(res, null, "Notifications marked as read");
}
