import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import { googleLoginSchema, loginSchema, registerSchema } from "./auth.validation";
import {
  loginWithFirebasePassword,
  loginWithGoogle,
  registerWithFirebase,
} from "./auth.service";

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);
  const result = await loginWithFirebasePassword(body.idToken);
  sendSuccess(res, result, "Login successful");
}

export async function register(req: Request, res: Response): Promise<void> {
  const body = registerSchema.parse(req.body);
  await registerWithFirebase(body);
  sendSuccess(res, null, "Registration successful", 201);
}

export async function googleLogin(req: Request, res: Response): Promise<void> {
  const body = googleLoginSchema.parse(req.body);
  const result = await loginWithGoogle(body.idToken);
  sendSuccess(res, result, "Login successful");
}
