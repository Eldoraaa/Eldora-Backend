import { prisma } from "@/config/database";
import { DeviceTelemetry } from "@/types/iot.types";

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
        localPairingToken: telemetry.localPairingToken,
        localPairingTokenUpdatedAt: new Date(),
      }),
      ...(telemetry.firmwareVersion !== undefined && {
        firmwareVersion: telemetry.firmwareVersion,
      }),
    },
  });
}
