import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import {
  deviceManagementSchema,
  localPairDeviceSchema,
  pairDeviceSchema,
  wifiCommandSchema,
} from "./devices.validation";
import {
  approvePairingRequest as approvePairingRequestService,
  getPairingRequests as getPairingRequestsService,
  getUserDevices,
  pairDevice as pairDeviceService,
  pairLocalDevice as pairLocalDeviceService,
  queueWifiConfig as queueWifiConfigService,
  rejectPairingRequest as rejectPairingRequestService,
  updateDeviceManagement as updateDeviceManagementService,
} from "./devices.service";

export async function getDevices(req: Request, res: Response): Promise<void> {
  const devices = await getUserDevices(req.user!.id);
  sendSuccess(res, devices);
}

export async function pairDevice(req: Request, res: Response): Promise<void> {
  const body = pairDeviceSchema.parse(req.body);
  const result = await pairDeviceService(req.user!.id, body);
  sendSuccess(res, result.data, result.message);
}

export async function pairLocalDevice(req: Request, res: Response): Promise<void> {
  const body = localPairDeviceSchema.parse(req.body);
  const result = await pairLocalDeviceService(req.user!.id, body);
  sendSuccess(res, result.data, result.message, result.statusCode);
}

export async function getPairingRequests(
  req: Request,
  res: Response
): Promise<void> {
  const requests = await getPairingRequestsService(req.user!.id);
  sendSuccess(res, requests);
}

export async function approvePairingRequest(
  req: Request,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const device = await approvePairingRequestService(req.user!.id, requestId);
  sendSuccess(res, device, "Pairing request approved");
}

export async function rejectPairingRequest(
  req: Request,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  await rejectPairingRequestService(req.user!.id, requestId);
  sendSuccess(res, null, "Pairing request rejected");
}

export async function queueWifiConfig(req: Request, res: Response): Promise<void> {
  const body = wifiCommandSchema.parse(req.body);
  const deviceId = req.params.id as string;
  const result = await queueWifiConfigService(req.user!.id, deviceId, body);
  sendSuccess(res, result, "WiFi setup queued");
}

export async function updateDeviceManagement(
  req: Request,
  res: Response
): Promise<void> {
  const body = deviceManagementSchema.parse(req.body);
  const devices = await updateDeviceManagementService(req.user!.id, body);
  sendSuccess(res, devices, "Device management updated");
}
