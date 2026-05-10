import { prisma } from "@/config/database";
import { DeviceTelemetry } from "@/types/iot.types";
import { createHash, timingSafeEqual } from "crypto";

const LOCAL_PAIRING_TOKEN_HASH_PREFIX = "sha256:";

export function hashLocalPairingToken(token: string): string {
  return `${LOCAL_PAIRING_TOKEN_HASH_PREFIX}${createHash("sha256")
    .update(token)
    .digest("hex")}`;
}

export function localPairingTokenMatches(
  storedToken: string,
  providedToken: string
): boolean {
  const expected = storedToken.startsWith(LOCAL_PAIRING_TOKEN_HASH_PREFIX)
    ? storedToken
    : hashLocalPairingToken(storedToken);
  const actual = hashLocalPairingToken(providedToken);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export async function updateDeviceHeartbeat(
  deviceId: string,
  telemetry: DeviceTelemetry
): Promise<void> {
  await prisma.device.update({
    where: { id: deviceId },
    data: {
      isOnline: true,
      lastSeen: new Date(),
      ...(telemetry.batteryLevel !== undefined && {
        batteryLevel: telemetry.batteryLevel,
      }),
      ...(telemetry.isCharging !== undefined && {
        isCharging: telemetry.isCharging,
      }),
      ...(telemetry.wifiSsid !== undefined && { wifiSsid: telemetry.wifiSsid }),
      ...(telemetry.wifiRssi !== undefined && { wifiRssi: telemetry.wifiRssi }),
      ...(telemetry.localIp !== undefined && { localIp: telemetry.localIp }),
      ...(telemetry.localPairingToken !== undefined && {
        localPairingToken: hashLocalPairingToken(telemetry.localPairingToken),
        localPairingTokenUpdatedAt: new Date(),
      }),
      ...(telemetry.firmwareVersion !== undefined && {
        firmwareVersion: telemetry.firmwareVersion,
      }),
    },
  });
}
