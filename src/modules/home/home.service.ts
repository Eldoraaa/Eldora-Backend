import { AppError } from "@/shared/errors";
import { randomBytes } from "crypto";
import type { HomeMemberRole } from "../../../generated/prisma/client";
import {
  acceptHomeInvitation,
  createHomeInvitation,
  createHomeForUser,
  ensureDefaultRoomsForHome,
  findPendingInvitationByCode,
  findFirstUserHome,
  findUserHomeById,
  findUserHomes,
  findUserHomeSummary,
  removeHomeMember,
  updateHome,
  updateHomeMemberRole,
} from "./home.repository";

const DEVICE_ONLINE_WINDOW_MS = 2 * 60 * 1000;
const INVITATION_EXPIRY_DAYS = 3;

function isRecentlySeen(lastSeen: Date | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() <= DEVICE_ONLINE_WINDOW_MS;
}

export async function getHomeSummary(userId: string) {
  const user = await findUserHomeSummary(userId);
  const devices = (
    user?.elderProfileLinks.flatMap((link) => link.elderProfile.devices) ?? []
  ).map((device) => ({
      ...device,
      isOnline: Boolean(device.isOnline && isRecentlySeen(device.lastSeen)),
    }));

  return { devices };
}

function formatRole(role: HomeMemberRole) {
  if (role === "home_owner") return "Home Owner";
  if (role === "administrator") return "Administrator";
  return "Common Member";
}

function createInviteCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

function assertCanManageHome(
  home: NonNullable<Awaited<ReturnType<typeof findUserHomeById>>>,
  userId: string
) {
  const member = home.members.find((item) => item.userId === userId);
  if (!member) throw new AppError("Home not found", 404);
  if (member.role === "common_member") {
    throw new AppError("Only home owners or administrators can manage this home", 403);
  }
}

function buildHomeListItem(home: Awaited<ReturnType<typeof findUserHomes>>[number]) {
  const currentMember = home.members[0];

  return {
    id: home.id,
    name: home.name,
    locationLabel: home.locationLabel,
    address: home.address,
    latitude: home.latitude,
    longitude: home.longitude,
    roomCount: home._count.rooms,
    memberCount: home._count.members,
    role: currentMember ? formatRole(currentMember.role) : "Common Member",
  };
}

function buildHomeSettings(home: NonNullable<Awaited<ReturnType<typeof findUserHomeById>>>) {
  return {
    id: home.id,
    name: home.name,
    locationLabel: home.locationLabel,
    address: home.address,
    latitude: home.latitude,
    longitude: home.longitude,
    roomCount: home._count.rooms,
    memberCount: home._count.members,
    rooms: home.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      slug: room.slug,
      sortOrder: room.sortOrder,
      isDefault: room.isDefault,
      deviceCount: room._count.devices,
    })),
    members: home.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      avatarUrl: member.user.avatarUrl,
      role: formatRole(member.role),
    })),
    invitations: home.invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: formatRole(invitation.role),
      status: invitation.status,
      inviteCode: invitation.inviteCode,
      expiresAt: invitation.expiresAt,
    })),
  };
}

export async function ensureDefaultHomeForUser(userId: string) {
  const existingHome = await findFirstUserHome(userId);
  if (existingHome) {
    await ensureDefaultRoomsForHome(existingHome.id);
    return existingHome;
  }
  return createHomeForUser(userId);
}

export async function getHomes(userId: string) {
  const homes = await findUserHomes(userId);
  return homes.map(buildHomeListItem);
}

export async function createHome(userId: string, input: { name: string }) {
  const home = await createHomeForUser(userId, input.name.trim() || "My Home");
  return {
    id: home.id,
    name: home.name,
    locationLabel: home.locationLabel,
    address: home.address,
    roomCount: home._count.rooms,
    memberCount: home._count.members,
    role: "Home Owner",
  };
}

export async function getHomeSettings(userId: string, homeId: string) {
  const home = await findUserHomeById(userId, homeId);
  if (!home) throw new AppError("Home not found", 404);
  return buildHomeSettings(home);
}

export async function updateHomeSettings(
  userId: string,
  homeId: string,
  input: {
    name?: string;
    locationLabel?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }
) {
  const home = await findUserHomeById(userId, homeId);
  if (!home) throw new AppError("Home not found", 404);

  const updatedHome = await updateHome(homeId, {
    ...(input.name !== undefined && { name: input.name.trim() }),
    ...(input.locationLabel !== undefined && { locationLabel: input.locationLabel }),
    ...(input.address !== undefined && { address: input.address }),
    ...(input.latitude !== undefined && { latitude: input.latitude }),
    ...(input.longitude !== undefined && { longitude: input.longitude }),
  });

  return {
    id: updatedHome.id,
    name: updatedHome.name,
    locationLabel: updatedHome.locationLabel,
    address: updatedHome.address,
    latitude: updatedHome.latitude,
    longitude: updatedHome.longitude,
    roomCount: updatedHome._count.rooms,
    memberCount: updatedHome._count.members,
  };
}

export async function changeHomeMemberRole(
  userId: string,
  homeId: string,
  memberId: string,
  role: HomeMemberRole
) {
  const home = await findUserHomeById(userId, homeId);
  if (!home) throw new AppError("Home not found", 404);
  await updateHomeMemberRole(homeId, memberId, role);
}

export async function deleteHomeMember(
  userId: string,
  homeId: string,
  memberId: string
) {
  const home = await findUserHomeById(userId, homeId);
  if (!home) throw new AppError("Home not found", 404);
  await removeHomeMember(homeId, memberId);
}

export async function createInviteForHome(
  userId: string,
  homeId: string,
  input: { email?: string | null; role: HomeMemberRole }
) {
  const home = await findUserHomeById(userId, homeId);
  if (!home) throw new AppError("Home not found", 404);
  assertCanManageHome(home, userId);

  const invitation = await createHomeInvitation({
    homeId,
    createdById: userId,
    email: input.email ?? null,
    role: input.role,
    inviteCode: createInviteCode(),
    expiresAt: new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  });

  return {
    id: invitation.id,
    email: invitation.email,
    role: formatRole(invitation.role),
    status: invitation.status,
    inviteCode: invitation.inviteCode,
    expiresAt: invitation.expiresAt,
  };
}

export async function joinHomeWithInviteCode(
  userId: string,
  input: { inviteCode: string }
) {
  const inviteCode = input.inviteCode.trim().toUpperCase();
  const invitation = await findPendingInvitationByCode(inviteCode);

  if (!invitation || invitation.status !== "pending") {
    throw new AppError("Invitation code is invalid", 404);
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    throw new AppError("Invitation code has expired", 410);
  }

  const home = await acceptHomeInvitation(
    invitation.id,
    invitation.homeId,
    userId,
    invitation.role
  );

  return buildHomeListItem(home);
}
