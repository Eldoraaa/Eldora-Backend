import { findUserHomeSummary } from "./home.repository";

const DEVICE_ONLINE_WINDOW_MS = 2 * 60 * 1000;

function isRecentlySeen(lastSeen: Date | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() <= DEVICE_ONLINE_WINDOW_MS;
}

export async function getHomeSummary(userId: string) {
  const user = await findUserHomeSummary(userId);
  const devices = (user?.elderProfiles.flatMap((ep) => ep.devices) ?? []).map(
    (device) => ({
      ...device,
      isOnline: Boolean(device.isOnline && isRecentlySeen(device.lastSeen)),
    })
  );

  return { devices };
}
