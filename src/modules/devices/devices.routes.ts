import { Router } from "express";
import { authenticate } from "@/middlewares";
import {
  approvePairingRequest,
  getDevices,
  getPairingRequests,
  pairDevice,
  pairLocalDevice,
  queueWifiConfig,
  rejectPairingRequest,
  updateDeviceManagement,
} from "./devices.controller";
import {
  createRoomCategory,
  deleteRoomCategory,
  listRoomCategories,
  updateRoomCategories,
} from "./rooms.controller";
import {
  getDeviceVoiceConfig,
  updateDeviceVoiceConfigController,
  testDeviceVoiceAudio,
} from "./voice-config.controller";

const router = Router();

/**
 * @swagger
 * /devices:
 *   get:
 *     tags: [Devices]
 *     summary: List devices for current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Device list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", authenticate, getDevices);

router.get("/room-categories", authenticate, listRoomCategories);
router.post("/room-categories", authenticate, createRoomCategory);
router.patch("/room-categories", authenticate, updateRoomCategories);
router.delete("/room-categories/:id", authenticate, deleteRoomCategory);
router.patch("/management", authenticate, updateDeviceManagement);

/**
 * @swagger
 * /devices/pair:
 *   post:
 *     tags: [Devices]
 *     summary: Pair a registered device
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceKey]
 *             properties:
 *               deviceKey:
 *                 type: string
 *               elderName:
 *                 type: string
 *               deviceName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device paired
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/pair", authenticate, pairDevice);

/**
 * @swagger
 * /devices/local-pair:
 *   post:
 *     tags: [Devices]
 *     summary: Pair a device using local pairing token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceKey, pairingToken]
 *             properties:
 *               deviceKey:
 *                 type: string
 *               pairingToken:
 *                 type: string
 *               elderName:
 *                 type: string
 *               deviceName:
 *                 type: string
 *               localIp:
 *                 type: string
 *               batteryLevel:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *               isCharging:
 *                 type: boolean
 *               wifiSsid:
 *                 type: string
 *               wifiRssi:
 *                 type: integer
 *                 minimum: -120
 *                 maximum: 0
 *               firmwareVersion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device paired
 *       202:
 *         description: Pairing request sent
 *       403:
 *         description: Invalid or expired token
 */
router.post("/local-pair", authenticate, pairLocalDevice);

/**
 * @swagger
 * /devices/pairing-requests:
 *   get:
 *     tags: [Devices]
 *     summary: List pending pairing requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pairing request list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/pairing-requests", authenticate, getPairingRequests);

/**
 * @swagger
 * /devices/pairing-requests/{id}/approve:
 *   post:
 *     tags: [Devices]
 *     summary: Approve a pairing request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pairing request approved
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/pairing-requests/:id/approve", authenticate, approvePairingRequest);

/**
 * @swagger
 * /devices/pairing-requests/{id}/reject:
 *   post:
 *     tags: [Devices]
 *     summary: Reject a pairing request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pairing request rejected
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/pairing-requests/:id/reject", authenticate, rejectPairingRequest);

/**
 * @swagger
 * /devices/{id}/wifi:
 *   post:
 *     tags: [Devices]
 *     summary: Queue WiFi configuration command
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ssid]
 *             properties:
 *               ssid:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: WiFi setup queued
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/wifi", authenticate, queueWifiConfig);
router.get("/:id/voice-config", authenticate, getDeviceVoiceConfig);
router.put("/:id/voice-config", authenticate, updateDeviceVoiceConfigController);
router.get("/:id/voice-test-audio", authenticate, testDeviceVoiceAudio);

export default router;
