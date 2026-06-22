import { prisma } from "@/config/database";
import type { HomeMemberRole, Prisma } from "../../../generated/prisma/client";

export const DEFAULT_HOME_ROOMS = [
  { name: "Living Room", slug: "living-room", sortOrder: 10 },
  { name: "Dining Room", slug: "dining-room", sortOrder: 20 },
  { name: "Bedroom", slug: "bedroom", sortOrder: 30 },
  { name: "Bathroom", slug: "bathroom", sortOrder: 40 },
  { name: "Kitchen", slug: "kitchen", sortOrder: 50 },
  { name: "Outdoor", slug: "outdoor", sortOrder: 60 },
];

export function findEmergencyContacts(userId: string, homeId?: string | null) {
  return prisma.msEmergencyContact.findMany({
    where: { userId, ...(homeId ? { homeId } : {}) },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

export function clearPrimaryEmergencyContacts(userId: string, homeId?: string | null) {
  return prisma.msEmergencyContact.updateMany({
    where: { userId, homeId: homeId ?? null },
    data: { isPrimary: false },
  });
}

export function createEmergencyContact(
  userId: string,
  input: { name: string; phone: string; relation?: string | null; isPrimary?: boolean; homeId?: string | null }
) {
  return prisma.msEmergencyContact.create({
    data: {
      userId,
      homeId: input.homeId ?? null,
      name: input.name,
      phone: input.phone,
      relation: input.relation ?? null,
      isPrimary: input.isPrimary ?? false,
    },
  });
}

export function updateEmergencyContact(
  userId: string,
  contactId: string,
  input: { name?: string; phone?: string; relation?: string | null; isPrimary?: boolean }
) {
  return prisma.msEmergencyContact.updateMany({
    where: { id: contactId, userId },
    data: input,
  });
}

export function deleteEmergencyContact(userId: string, contactId: string) {
  return prisma.msEmergencyContact.deleteMany({
    where: { id: contactId, userId },
  });
}

export function findUserHomeSummary(userId: string) {
  return prisma.msUser.findUnique({
    where: { id: userId },
    include: {
      elderProfileLinks: {
        include: {
          elderProfile: {
            include: {
              devices: {
                select: {
                  id: true,
                  deviceId: true,
                  name: true,
                  isOnline: true,
                  lastSeen: true,
                  batteryLevel: true,
                  isCharging: true,
                  wifiSsid: true,
                  wifiRssi: true,
                  firmwareVersion: true,
                  roomCategory: { select: { homeId: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

export function findOpenAlarmNotifications(userId: string, homeId?: string | null) {
  return prisma.trNotification.findMany({
    where: {
      userId,
      type: "alarm",
      ...(homeId ? { homeId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      device: { select: { id: true, deviceId: true, name: true } },
      home: { select: { id: true, name: true } },
    },
  }).then((notifications) =>
    notifications.filter((notification) => {
      const metadata = notification.metadata;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return true;
      return typeof (metadata as Record<string, unknown>).resolvedAt !== "string";
    })
  );
}

export function findRecentUserNotifications(userId: string, limit = 10) {
  return prisma.trNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      device: { select: { id: true, deviceId: true, name: true } },
      home: { select: { id: true, name: true } },
      responses: { orderBy: { createdAt: "asc" } },
    },
  });
}

export function findUserHomes(userId: string) {
  return prisma.msHome.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { rooms: true, members: true } },
    },
  });
}

export function findUserHomeById(userId: string, homeId: string) {
  return prisma.msHome.findFirst({
    where: { id: homeId, members: { some: { userId } } },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      rooms: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { devices: true } } },
      },
      invitations: {
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { rooms: true, members: true } },
    },
  });
}

export function findFirstUserHome(userId: string) {
  return prisma.msHome.findFirst({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function findHomeMemberUserIds(homeId: string) {
  const members = await prisma.trHomeMember.findMany({
    where: { homeId },
    select: { userId: true },
  });
  return members.map((member) => member.userId);
}

export async function ensureDefaultRoomsForHome(homeId: string) {
  await prisma.$transaction(
    DEFAULT_HOME_ROOMS.map((room) =>
      prisma.msRoomCategory.upsert({
        where: {
          homeId_slug: {
            homeId,
            slug: room.slug,
          },
        },
        create: {
          ...room,
          isDefault: true,
          home: { connect: { id: homeId } },
        },
        update: {
          name: room.name,
          sortOrder: room.sortOrder,
          isDefault: true,
        },
      })
    )
  );
}

export function createHomeForUser(userId: string, name = "My Home") {
  return prisma.msHome.create({
    data: {
      name,
      locationLabel: null,
      address: null,
      latitude: null,
      longitude: null,
      members: {
        create: {
          userId,
          role: "home_owner",
        },
      },
      rooms: {
        create: DEFAULT_HOME_ROOMS.map((room) => ({
          ...room,
          isDefault: true,
        })),
      },
    },
    include: {
      members: true,
      _count: { select: { rooms: true, members: true } },
    },
  });
}

export function updateHome(
  homeId: string,
  data: Prisma.MsHomeUpdateInput
) {
  return prisma.msHome.update({
    where: { id: homeId },
    data,
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      },
      _count: { select: { rooms: true, members: true } },
    },
  });
}

export function updateHomeMemberRole(
  homeId: string,
  memberId: string,
  role: HomeMemberRole
) {
  return prisma.trHomeMember.updateMany({
    where: { id: memberId, homeId },
    data: { role },
  });
}

export function removeHomeMember(homeId: string, memberId: string) {
  return prisma.trHomeMember.deleteMany({
    where: { id: memberId, homeId },
  });
}

export function createHomeInvitation(input: {
  homeId: string;
  createdById: string;
  inviteCode: string;
  email?: string | null;
  role: HomeMemberRole;
  expiresAt: Date;
}) {
  return prisma.trHomeInvitation.create({
    data: input,
  });
}

export function findPendingInvitationByCode(inviteCode: string) {
  return prisma.trHomeInvitation.findUnique({
    where: { inviteCode },
    include: {
      home: {
        include: {
          members: true,
          _count: { select: { rooms: true, members: true } },
        },
      },
    },
  });
}

export async function acceptHomeInvitation(
  invitationId: string,
  homeId: string,
  userId: string,
  role: HomeMemberRole
) {
  return prisma.$transaction(async (tx) => {
    await tx.trHomeMember.upsert({
      where: { homeId_userId: { homeId, userId } },
      create: { homeId, userId, role },
      update: {},
    });

    await tx.trHomeInvitation.update({
      where: { id: invitationId },
      data: { status: "accepted" },
    });

    return tx.msHome.findUniqueOrThrow({
      where: { id: homeId },
      include: {
        members: {
          where: { userId },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        _count: { select: { rooms: true, members: true } },
      },
    });
  });
}
