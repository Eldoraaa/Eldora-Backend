import { prisma } from "@/config/database";
import type { Prisma } from "../../../generated/prisma/client";

export function findRoomCategories(homeId: string) {
  return prisma.msRoomCategory.findMany({
    where: { homeId, slug: { not: "all" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { devices: true } } },
  });
}

export function findRoomCategoryById(homeId: string, roomId: string) {
  return prisma.msRoomCategory.findFirst({
    where: { id: roomId, homeId },
    include: { _count: { select: { devices: true } } },
  });
}

export function findRoomCategoryBySlug(homeId: string, slug: string) {
  return prisma.msRoomCategory.findFirst({
    where: { homeId, slug },
    include: { _count: { select: { devices: true } } },
  });
}

export function createRoomCategory(data: Prisma.MsRoomCategoryCreateInput) {
  return prisma.msRoomCategory.create({
    data,
    include: { _count: { select: { devices: true } } },
  });
}

export function updateRoomCategory(
  id: string,
  data: Prisma.MsRoomCategoryUpdateInput
) {
  return prisma.msRoomCategory.update({
    where: { id },
    data,
    include: { _count: { select: { devices: true } } },
  });
}

export function deleteRoomCategory(id: string) {
  return prisma.msRoomCategory.delete({ where: { id } });
}

export function updateRoomCategoryOrder(
  homeId: string,
  rooms: Array<{ id: string; name?: string; sortOrder?: number }>
) {
  return prisma.$transaction(
    rooms.map((room) =>
      prisma.msRoomCategory.update({
        where: { id: room.id, homeId },
        data: {
          ...(room.name !== undefined && {
            name: room.name,
            slug: slugifyRoom(room.name),
          }),
          ...(room.sortOrder !== undefined && { sortOrder: room.sortOrder }),
        },
        include: { _count: { select: { devices: true } } },
      })
    )
  );
}

export function slugifyRoom(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
