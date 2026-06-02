import { Router } from "express";
import {
  authenticateDevice,
  authenticateOrRegisterDevice,
} from "@/middlewares";
import {
  acknowledgeCommand,
  getCommands,
  postDeviceOfflineEvent,
  postFallEvent,
  postHeartbeat,
} from "./iot.controller";

const router = Router();

/**
 * @swagger
 * /iot/heartbeat:
 *   post:
 *     tags: [IoT]
 *     summary: Send device heartbeat
 *     security:
 *       - deviceKey: []
 *       - deviceProvisioningSecret: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
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
 *               localIp:
 *                 type: string
 *               localPairingToken:
 *                 type: string
 *               firmwareVersion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Heartbeat received
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/heartbeat", authenticateOrRegisterDevice, postHeartbeat);

router.post("/events/fall", authenticateDevice, postFallEvent);
router.post("/events/offline", authenticateDevice, postDeviceOfflineEvent);

/**
 * @swagger
 * /iot/commands:
 *   get:
 *     tags: [IoT]
 *     summary: Fetch pending device commands
 *     security:
 *       - deviceKey: []
 *       - deviceProvisioningSecret: []
 *     responses:
 *       200:
 *         description: Commands fetched
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/commands", authenticateDevice, getCommands);

/**
 * @swagger
 * /iot/commands/{id}/ack:
 *   post:
 *     tags: [IoT]
 *     summary: Acknowledge a device command
 *     security:
 *       - deviceKey: []
 *       - deviceProvisioningSecret: []
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [applied, failed]
 *               message:
 *                 type: string
 *                 maxLength: 160
 *     responses:
 *       200:
 *         description: Command acknowledged
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/commands/:id/ack", authenticateDevice, acknowledgeCommand);

export default router;
