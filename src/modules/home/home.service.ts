import { AppError } from "@/shared/errors";
import { randomBytes } from "crypto";
import type { HomeMemberRole } from "../../../generated/prisma/client";
import {
  acceptHomeInvitation,
  clearPrimaryEmergencyContacts,
  createEmergencyContact,
  createHomeInvitation,
  createHomeForUser,
  deleteEmergencyContact,
  ensureDefaultRoomsForHome,
  findEmergencyContacts,
  findOpenAlarmNotifications,
  findPendingInvitationByCode,
  findFirstUserHome,
  findRecentUserNotifications,
  findUserHomeById,
  findUserHomes,
  findUserHomeSummary,
  removeHomeMember,
  updateHome,
  updateHomeMemberRole,
} from "./home.repository";

const DEVICE_ONLINE_WINDOW_MS = 10 * 60 * 1000;
const LOW_BATTERY_THRESHOLD = 20;
const INVITATION_EXPIRY_DAYS = 3;

function isRecentlySeen(lastSeen: Date | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() <= DEVICE_ONLINE_WINDOW_MS;
}

function buildSummaryDevices(user: Awaited<ReturnType<typeof findUserHomeSummary>>) {
  return (
    user?.elderProfileLinks.flatMap((link) =>
      link.elderProfile.devices.map((device) => ({
        ...device,
        elderName: link.elderProfile.name,
        isOnline: Boolean(device.isOnline && isRecentlySeen(device.lastSeen)),
      }))
    ) ?? []
  );
}

function metadataRecord(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function notificationEventType(notification: { metadata: unknown }) {
  const metadata = metadataRecord(notification.metadata);
  return typeof metadata.eventType === "string" ? metadata.eventType : null;
}

function notificationSeverity(notification: { metadata: unknown }) {
  const metadata = metadataRecord(notification.metadata);
  return typeof metadata.severity === "string" ? metadata.severity : "normal";
}

function notificationIsResolved(notification: { metadata: unknown }) {
  return typeof metadataRecord(notification.metadata).resolvedAt === "string";
}

function deviceRiskFlags(devices: ReturnType<typeof buildSummaryDevices>) {
  const offlineCount = devices.filter((device) => !device.isOnline).length;
  const staleCount = devices.filter((device) => !device.lastSeen).length;
  const lowBatteryCount = devices.filter(
    (device) => typeof device.batteryLevel === "number" && device.batteryLevel <= LOW_BATTERY_THRESHOLD
  ).length;

  return {
    offlineCount,
    staleCount,
    lowBatteryCount,
    flags: [
      ...(offlineCount > 0 ? ["device_offline"] : []),
      ...(staleCount > 0 ? ["no_heartbeat"] : []),
      ...(lowBatteryCount > 0 ? ["low_battery"] : []),
    ],
  };
}

export async function getHomeSummary(userId: string) {
  const user = await findUserHomeSummary(userId);
  return { devices: buildSummaryDevices(user) };
}

export async function getSafetySummary(userId: string, homeId?: string | null) {
  const user = await findUserHomeSummary(userId);
  const devices = buildSummaryDevices(user).filter((device) => !homeId || device.roomCategory?.homeId === homeId);
  const notifications = (await findRecentUserNotifications(userId, 10)).filter((notification) => !homeId || notification.homeId === homeId);
  const openAlerts = await findOpenAlarmNotifications(userId, homeId);
  const scopedContacts = await findEmergencyContacts(userId, homeId);
  const contacts = scopedContacts.length > 0 || !homeId ? scopedContacts : await findEmergencyContacts(userId, null);
  const openAlert = openAlerts[0] ?? null;
  const primaryDevice =
    devices.find((device) => `${device.name ?? ""} ${device.deviceId}`.toLowerCase().includes("aegis")) ??
    devices[0] ??
    null;
  const deviceFlags = deviceRiskFlags(devices);
  const recentCriticalAlerts = notifications.filter(
    (notification) => notificationSeverity(notification) === "critical"
  ).length;
  const unresolvedCriticalCount = openAlerts.filter(
    (notification) => notificationSeverity(notification) === "critical" && !notificationIsResolved(notification)
  ).length;
  const pendingFollowUpCount = openAlerts.filter((notification) => {
    const metadata = metadataRecord(notification.metadata);
    return typeof metadata.followUpAt === "string" && typeof metadata.followUpSentAt !== "string";
  }).length;
  const riskScore = Math.min(
    100,
    openAlert ? 85 + Math.min(unresolvedCriticalCount * 5, 10)
      : devices.length === 0 ? 50
        : 18 + deviceFlags.offlineCount * 28 + deviceFlags.lowBatteryCount * 12 + recentCriticalAlerts * 8
  );
  const riskLevel = riskScore >= 80 ? "high" : riskScore >= 50 ? "medium" : "low";
  const anomalyFlags = [
    ...(openAlert ? ["open_alert"] : []),
    ...(unresolvedCriticalCount > 0 ? ["unresolved_critical"] : []),
    ...(pendingFollowUpCount > 0 ? ["no_response_alert"] : []),
    ...(recentCriticalAlerts >= 2 ? ["frequent_alerts"] : []),
    ...deviceFlags.flags,
  ];

  return {
    elder: primaryDevice
      ? { name: primaryDevice.elderName, primaryDeviceId: primaryDevice.id }
      : null,
    status: openAlert ? "needs_attention" : primaryDevice?.isOnline ? "safe" : primaryDevice ? "device_offline" : "setup_needed",
    openAlert,
    latestEvent: notifications[0] ?? null,
    emergencyContact: contacts[0] ?? null,
    unresolvedAlertCount: openAlerts.length,
    risk: {
      score: riskScore,
      level: riskLevel,
      anomalyFlags,
      recommendation: openAlert
        ? "Respond to the open alert immediately."
        : deviceFlags.offlineCount > 0
          ? "Check offline devices before relying on automation."
          : deviceFlags.lowBatteryCount > 0
            ? "Charge low-battery devices to keep monitoring reliable."
            : "Monitoring is normal based on available device data.",
    },
    devices,
  };
}

export async function getWellnessSummary(userId: string, homeId?: string | null) {
  const user = await findUserHomeSummary(userId);
  const devices = buildSummaryDevices(user).filter((device) => !homeId || device.roomCategory?.homeId === homeId);
  const notifications = (await findRecentUserNotifications(userId, 25)).filter((notification) => !homeId || notification.homeId === homeId);
  const openAlerts = await findOpenAlarmNotifications(userId, homeId);
  const deviceFlags = deviceRiskFlags(devices);
  const criticalCount = notifications.filter((notification) => notificationSeverity(notification) === "critical").length;
  const fallCount = notifications.filter((notification) => notificationEventType(notification) === "fall_detected").length;
  const sosCount = notifications.filter((notification) => notificationEventType(notification) === "sos").length;
  const followUpCount = notifications.filter((notification) => notificationEventType(notification) === "alert_follow_up").length;
  const responseCount = notifications.reduce((total, notification) => {
    const responses = "responses" in notification && Array.isArray(notification.responses) ? notification.responses.length : 0;
    return total + responses;
  }, 0);
  const distressScore = Math.min(
    100,
    criticalCount * 25 + openAlerts.length * 30 + followUpCount * 18 + deviceFlags.offlineCount * 12 + deviceFlags.lowBatteryCount * 8
  );
  const distressLevel = distressScore >= 70 ? "high" : distressScore >= 35 ? "medium" : "low";
  const moodTrend = distressLevel === "high" ? "distressed" : distressLevel === "medium" ? "needs_attention" : "stable";
  const interactionSummary = responseCount > 0
    ? `${responseCount} caregiver response(s) recorded across recent Eldora alerts.`
    : notifications.length > 0
      ? "Recent alerts were recorded, but caregiver response activity is still limited."
      : "No recent alert or interaction activity recorded.";
  const careSignals = [
    ...(fallCount > 0 ? [`${fallCount} fall alert(s)`] : []),
    ...(sosCount > 0 ? [`${sosCount} SOS request(s)`] : []),
    ...(followUpCount > 0 ? [`${followUpCount} unresolved follow-up alert(s)`] : []),
    ...(deviceFlags.offlineCount > 0 ? [`${deviceFlags.offlineCount} offline device(s)`] : []),
    ...(deviceFlags.lowBatteryCount > 0 ? [`${deviceFlags.lowBatteryCount} low-battery device(s)`] : []),
  ];

  return {
    period: "recent_activity",
    moodTrend,
    distressLevel,
    distressScore,
    interactionSummary,
    careSignals,
    recommendation: openAlerts.length > 0
      ? "Prioritize resolving open alerts and confirming the elder is safe."
      : distressLevel === "medium"
        ? "Check in with the elder and review device reliability."
        : "Wellness signals look stable based on available Eldora activity.",
    generatedAt: new Date().toISOString(),
  };
}

async function assertHomeAccessIfProvided(userId: string, homeId?: string | null) {
  if (!homeId) return;
  const home = await findUserHomeById(userId, homeId);
  if (!home) throw new AppError("Home not found", 404);
}

export async function getEmergencyContacts(userId: string, homeId?: string | null) {
  const contacts = await findEmergencyContacts(userId, homeId);
  if (contacts.length > 0 || !homeId) return contacts;
  return findEmergencyContacts(userId, null);
}

export async function addEmergencyContact(
  userId: string,
  input: { name: string; phone: string; relation?: string | null; isPrimary?: boolean; homeId?: string | null }
) {
  await assertHomeAccessIfProvided(userId, input.homeId);
  if (input.isPrimary) {
    await clearPrimaryEmergencyContacts(userId, input.homeId);
  }
  return createEmergencyContact(userId, input);
}

export async function removeEmergencyContact(userId: string, contactId: string) {
  await deleteEmergencyContact(userId, contactId);
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
  assertCanManageHome(home, userId);
  const targetMember = home.members.find((member) => member.id === memberId);
  if (!targetMember) throw new AppError("Member not found", 404);
  if (targetMember.userId === userId && role === "common_member") {
    throw new AppError("Home owners or administrators cannot demote themselves", 400);
  }
  await updateHomeMemberRole(homeId, memberId, role);
}

export async function deleteHomeMember(
  userId: string,
  homeId: string,
  memberId: string
) {
  const home = await findUserHomeById(userId, homeId);
  if (!home) throw new AppError("Home not found", 404);
  assertCanManageHome(home, userId);
  const targetMember = home.members.find((member) => member.id === memberId);
  if (!targetMember) throw new AppError("Member not found", 404);
  if (targetMember.userId === userId) {
    throw new AppError("You cannot remove yourself from the home", 400);
  }
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
