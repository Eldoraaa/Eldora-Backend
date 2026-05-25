import { prisma } from "@/config/database";

export function findUserByFirebaseUidOrEmail(firebaseUid: string, email: string) {
  return prisma.user.findFirst({
    where: { OR: [{ googleId: firebaseUid }, { email }] },
  });
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function createUser(data: {
  name: string;
  email: string;
  googleId: string;
  avatarUrl?: string | null;
}) {
  return prisma.user.create({ data });
}

export function linkGoogleAccount(
  userId: string,
  data: { googleId: string; avatarUrl?: string | null }
) {
  return prisma.user.update({
    where: { id: userId },
    data,
  });
}
