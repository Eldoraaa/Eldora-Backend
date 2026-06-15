import { prisma } from "@/config/database";

export type VoiceConfigInput = {
  enabled?: boolean;
  language?: string;
  ttsVoice?: string;
  ttsRate?: string;
};

export function findOrCreateDeviceVoiceConfig(deviceId: string) {
  return prisma.msDeviceVoiceConfig.upsert({
    where: { deviceId },
    update: {},
    create: { deviceId },
  });
}

export function updateDeviceVoiceConfig(deviceId: string, data: VoiceConfigInput) {
  return prisma.msDeviceVoiceConfig.upsert({
    where: { deviceId },
    update: data,
    create: { deviceId, ...data },
  });
}
