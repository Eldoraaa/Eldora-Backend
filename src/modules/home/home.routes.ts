import { Router } from "express";
import { authenticate } from "@/middlewares";
import { getSummary } from "./home.controller";

const router = Router();

router.get("/summary", authenticate, getSummary);

export default router;
