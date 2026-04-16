import { Router } from "express";
import { login, register, googleLogin, registerFcmToken } from "@/controllers/auth.controller";
import { authenticate } from "@/middlewares/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.post("/google", googleLogin);
router.post("/register-fcm-token", authenticate, registerFcmToken);

export default router;
