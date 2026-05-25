import { z } from "zod";

export const loginSchema = z.object({
  idToken: z.string().min(1, "ID token is required"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  idToken: z.string().min(1, "ID token is required"),
  mobile: z.string().optional(),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, "ID token is required"),
});
