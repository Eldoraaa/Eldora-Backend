import { Router } from "express";
import { getSummary } from "@/controllers/home.controller";
import { authenticate } from "@/middlewares/auth.middleware";

const router = Router();

router.get("/summary", authenticate, getSummary);

export default router;
