import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import {
  acknowledgeElderReminder,
  approveMemoryFact,
  cancelElderReminder,
  getElderReminder,
  listElderReminders,
  listMemoryFacts,
  processDeviceVoiceAudio,
  rejectMemoryFact,
  testSpeakOnDevice,
} from "./voice.service";

export async function processDeviceVoiceAudioController(
  req: Request,
  res: Response
): Promise<void> {
  const audio = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  const result = await processDeviceVoiceAudio(audio, req.device!.id);
  sendSuccess(res, result, "Voice audio processed");
}

export async function testSpeakController(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.id;
  const result = await testSpeakOnDevice(userId);
  sendSuccess(res, result, "Voice test sent to DoraBot");
}

export async function listElderRemindersController(req: Request, res: Response): Promise<void> {
  const homeId = typeof req.query.homeId === "string" ? req.query.homeId : null;
  const result = await listElderReminders(req.user!.id, homeId);
  sendSuccess(res, result, "Elder reminders fetched");
}

export async function listMemoryFactsController(req: Request, res: Response): Promise<void> {
  const status = typeof req.query.status === "string" ? req.query.status : "candidate";
  const result = await listMemoryFacts(req.user!.id, status);
  sendSuccess(res, result, "Memory facts fetched");
}

export async function approveMemoryFactController(req: Request, res: Response): Promise<void> {
  const result = await approveMemoryFact(req.user!.id, req.params.id as string);
  sendSuccess(res, result, "Memory fact approved");
}

export async function rejectMemoryFactController(req: Request, res: Response): Promise<void> {
  const result = await rejectMemoryFact(req.user!.id, req.params.id as string);
  sendSuccess(res, result, "Memory fact rejected");
}

export async function getElderReminderController(req: Request, res: Response): Promise<void> {
  const result = await getElderReminder(req.user!.id, req.params.id as string);
  sendSuccess(res, result, "Elder reminder fetched");
}

export async function cancelElderReminderController(req: Request, res: Response): Promise<void> {
  const result = await cancelElderReminder(req.user!.id, req.params.id as string);
  sendSuccess(res, result, "Reminder cancelled");
}

export async function acknowledgeElderReminderController(req: Request, res: Response): Promise<void> {
  const result = await acknowledgeElderReminder(req.user!.id, req.params.id as string);
  sendSuccess(res, result, "Reminder acknowledged");
}
