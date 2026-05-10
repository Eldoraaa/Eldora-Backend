import { Router } from "express";
import {
  approvePairingRequest,
  getDevices,
  getPairingRequests,
  pairDevice,
  pairLocalDevice,
  queueWifiConfig,
  rejectPairingRequest,
} from "@/controllers/devices.controller";
import { authenticate } from "@/middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, getDevices);
router.post("/pair", authenticate, pairDevice);
router.post("/local-pair", authenticate, pairLocalDevice);
router.get("/pairing-requests", authenticate, getPairingRequests);
router.post("/pairing-requests/:id/approve", authenticate, approvePairingRequest);
router.post("/pairing-requests/:id/reject", authenticate, rejectPairingRequest);
router.post("/:id/wifi", authenticate, queueWifiConfig);

export default router;
