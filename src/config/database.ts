import { PrismaClient } from "../../generated/prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Prisma v7: constructor requires args per TS types; cast bypasses while using prisma.config.ts for connection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: PrismaClient = global.__prisma ?? new (PrismaClient as any)();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
