import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, "Room name is required").max(40),
});

export const updateRoomsSchema = z.object({
  rooms: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1).max(40).optional(),
        sortOrder: z.number().int().min(0).optional(),
      })
    )
    .min(1),
});
