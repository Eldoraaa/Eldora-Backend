import { AppError } from "@/shared/errors";
import {
  createRoomCategory,
  deleteRoomCategory,
  findRoomCategories,
  findRoomCategoryById,
  findRoomCategoryBySlug,
  slugifyRoom,
  updateRoomCategoryOrder,
} from "./rooms.repository";
import { findFirstUserHome, findUserHomeById } from "@/modules/home/home.repository";

function buildRoomResponse(
  room: Awaited<ReturnType<typeof findRoomCategories>>[number]
) {
  return {
    id: room.id,
    name: room.name,
    slug: room.slug,
    sortOrder: room.sortOrder,
    isDefault: room.isDefault,
    deviceCount: room._count.devices,
  };
}

async function resolveRoomHome(userId: string, homeId?: string | null) {
  if (!homeId) {
    const home = await findFirstUserHome(userId);
    if (!home) throw new AppError("Home not found", 404);
    return home;
  }

  const home = await findUserHomeById(userId, homeId);
  if (!home) throw new AppError("Home not found", 404);
  return home;
}

export async function getRoomCategories(userId: string, homeId?: string | null) {
  if (!homeId) {
    const home = await findFirstUserHome(userId);
    if (!home) return [];
    const rooms = await findRoomCategories(home.id);
    return rooms.map(buildRoomResponse);
  }

  const home = await resolveRoomHome(userId, homeId);
  const rooms = await findRoomCategories(home.id);
  return rooms.map(buildRoomResponse);
}

export async function createRoom(
  userId: string,
  input: { name: string },
  homeId?: string | null
) {
  const home = await resolveRoomHome(userId, homeId);
  const name = input.name.trim();
  const slug = slugifyRoom(name);

  if (!slug) {
    throw new AppError("Room name is required", 400);
  }

  const existingRoom = await findRoomCategoryBySlug(home.id, slug);
  if (existingRoom) {
    throw new AppError("Room already exists", 409);
  }

  const rooms = await findRoomCategories(home.id);
  const room = await createRoomCategory({
    name,
    slug,
    sortOrder: rooms.length * 10 + 10,
    isDefault: false,
    home: { connect: { id: home.id } },
  });

  return buildRoomResponse(room);
}

export async function updateRooms(
  userId: string,
  input: { rooms: Array<{ id: string; name?: string; sortOrder?: number }> },
  homeId?: string | null
) {
  const home = await resolveRoomHome(userId, homeId);
  const currentRooms = await findRoomCategories(home.id);
  const currentIds = new Set(currentRooms.map((room) => room.id));

  for (const room of input.rooms) {
    if (!currentIds.has(room.id)) {
      throw new AppError("Room not found", 404);
    }
  }

  const rooms = await updateRoomCategoryOrder(home.id, input.rooms);
  return rooms.map(buildRoomResponse);
}

export async function deleteRoom(
  userId: string,
  roomId: string,
  homeId?: string | null
) {
  const home = await resolveRoomHome(userId, homeId);
  const room = await findRoomCategoryById(home.id, roomId);
  if (!room) {
    throw new AppError("Room not found", 404);
  }

  if (room.isDefault) {
    throw new AppError("Default room cannot be deleted", 400);
  }

  await deleteRoomCategory(roomId);
}
