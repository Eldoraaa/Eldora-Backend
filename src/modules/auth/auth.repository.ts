import { prisma } from "@/config/database";

export function findUserByFirebaseUidOrEmail(firebaseUid: string, email: string) {
  return prisma.msUser.findFirst({
    where: { OR: [{ googleId: firebaseUid }, { email }] },
  });
}

export function findUserByEmail(email: string) {
  return prisma.msUser.findUnique({ where: { email } });
}

export function findUserById(userId: string) {
  return prisma.msUser.findUnique({ where: { id: userId } });
}

export function createUser(data: {
  name: string;
  email: string;
  googleId: string;
  avatarUrl?: string | null;
}) {
  return prisma.msUser.create({
    data,
  });
}

export function linkGoogleAccount(
  userId: string,
  data: { googleId: string; avatarUrl?: string | null }
) {
  return prisma.msUser.update({
    where: { id: userId },
    data,
  });
}

export function deleteUserAccount(userId: string) {
  return prisma.$transaction([
    prisma.trDevicePairingRequest.deleteMany({
      where: { requesterId: userId },
    }),
    prisma.msScene.updateMany({
      where: { createdById: userId },
      data: { createdById: null },
    }),
    prisma.msUser.delete({
      where: { id: userId },
    }),
  ]);
}
