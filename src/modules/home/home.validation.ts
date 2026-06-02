import { z } from "zod";

const memberRoleSchema = z.enum(["home_owner", "administrator", "common_member"]);

export const createHomeSchema = z.object({
  name: z.string().trim().min(1, "Home name is required").max(60),
});

export const updateHomeSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  locationLabel: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

export const updateHomeMemberRoleSchema = z.object({
  role: memberRoleSchema,
});

export const joinHomeSchema = z.object({
  inviteCode: z.string().trim().min(4, "Invitation code is required").max(32),
});

export const createHomeInvitationSchema = z.object({
  email: z.string().trim().email().nullable().optional(),
  role: memberRoleSchema.default("common_member"),
});
