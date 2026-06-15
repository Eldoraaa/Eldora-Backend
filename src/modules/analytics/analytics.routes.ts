import { Router } from "express";
import { authenticate } from "@/middlewares";
import { getElderAnalyticsController } from "./analytics.controller";

const router = Router();

router.get("/elder", authenticate, getElderAnalyticsController);

export default router;
