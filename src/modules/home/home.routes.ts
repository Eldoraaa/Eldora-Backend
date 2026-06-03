import { Router } from "express";
import { authenticate } from "@/middlewares";
import {
  createEmergencyContactController,
  createHomeController,
  createHomeInvitationController,
  deleteEmergencyContactController,
  getHomeSettingsController,
  getSafetySummaryController,
  getSummary,
  getWellnessSummaryController,
  listEmergencyContactsController,
  joinHomeController,
  listHomes,
  removeHomeMemberController,
  updateHomeMemberRoleController,
  updateHomeSettingsController,
} from "./home.controller";

const router = Router();

/**
 * @swagger
 * /home/summary:
 *   get:
 *     tags: [Home]
 *     summary: Get home summary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Home summary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/summary", authenticate, getSummary);
router.get("/safety-summary", authenticate, getSafetySummaryController);
router.get("/wellness-summary", authenticate, getWellnessSummaryController);
router.get("/emergency-contacts", authenticate, listEmergencyContactsController);
router.post("/emergency-contacts", authenticate, createEmergencyContactController);
router.delete("/emergency-contacts/:contactId", authenticate, deleteEmergencyContactController);
router.get("/homes", authenticate, listHomes);
router.post("/homes", authenticate, createHomeController);
router.post("/homes/join", authenticate, joinHomeController);
router.get("/homes/:id", authenticate, getHomeSettingsController);
router.patch("/homes/:id", authenticate, updateHomeSettingsController);
router.post(
  "/homes/:id/invitations",
  authenticate,
  createHomeInvitationController
);
router.patch(
  "/homes/:id/members/:memberId",
  authenticate,
  updateHomeMemberRoleController
);
router.delete(
  "/homes/:id/members/:memberId",
  authenticate,
  removeHomeMemberController
);

export default router;
