import type { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import {
  createRoom,
  deleteRoom,
  getRoomCategories,
  updateRooms,
} from "./rooms.service";
import {
  createRoomSchema,
  updateRoomsSchema,
} from "./rooms.validation";

function getHomeId(req: Request) {
  const homeId = req.query.homeId;
  return typeof homeId === "string" && homeId.trim() ? homeId.trim() : null;
}

export async function listRoomCategories(
  req: Request,
  res: Response
): Promise<void> {
  const rooms = await getRoomCategories(req.user!.id, getHomeId(req));
  sendSuccess(res, rooms);
}

export async function createRoomCategory(
  req: Request,
  res: Response
): Promise<void> {
  const body = createRoomSchema.parse(req.body);
  const room = await createRoom(req.user!.id, body, getHomeId(req));
  sendSuccess(res, room, "Room created", 201);
}

export async function updateRoomCategories(
  req: Request,
  res: Response
): Promise<void> {
  const body = updateRoomsSchema.parse(req.body);
  const rooms = await updateRooms(req.user!.id, body, getHomeId(req));
  sendSuccess(res, rooms, "Rooms updated");
}

export async function deleteRoomCategory(
  req: Request,
  res: Response
): Promise<void> {
  const roomId = req.params.id as string;
  await deleteRoom(req.user!.id, roomId, getHomeId(req));
  sendSuccess(res, null, "Room deleted");
}
