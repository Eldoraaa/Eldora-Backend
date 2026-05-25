import { Router } from "express";
import { authenticate } from "@/middlewares";
import { getSummary } from "./home.controller";

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

export default router;
