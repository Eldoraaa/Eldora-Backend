import jwt from "jsonwebtoken";
import { config } from "@/config/env";
import { UserRole } from "../../generated/prisma/client";

export interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
