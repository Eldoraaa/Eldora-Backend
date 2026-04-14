import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/config/database";
import { signToken } from "@/utils/jwt.utils";
import { sendSuccess, sendError } from "@/utils/response.utils";

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

const registerFcmSchema = z.object({
  fcmToken: z.string().min(1, "Token FCM wajib diisi"),
  platform: z.enum(["ios", "android", "web"]),
});

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) {
    sendError(res, "Email atau password salah", 401);
    return;
  }

  const valid = await bcrypt.compare(body.password, user.password);
  if (!valid) {
    sendError(res, "Email atau password salah", 401);
    return;
  }

  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  sendSuccess(res, { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } }, "Login berhasil");
}

export async function registerFcmToken(req: Request, res: Response): Promise<void> {
  const body = registerFcmSchema.parse(req.body);
  const userId = req.user!.id;

  await prisma.notificationToken.upsert({
    where: { fcmToken: body.fcmToken },
    update: { userId, platform: body.platform },
    create: { fcmToken: body.fcmToken, platform: body.platform, userId },
  });

  sendSuccess(res, null, "FCM token berhasil didaftarkan");
}
