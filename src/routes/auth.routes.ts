import { Router } from "express";
import { login, registerFcmToken } from "@/controllers/auth.controller";
import { authenticate } from "@/middlewares/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/register-fcm-token", authenticate, registerFcmToken);

export default router;
